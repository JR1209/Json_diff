/**
 * 主控制器 - 多文件并排对比（基于键路径）
 */

class JSONDiffApp {
    constructor() {
        this.files = [];
        this.diffEngine = null;
        this.mergeEngine = null;
        this.diffResult = null;
        this.diffCache = new Map(); // 缓存diff计算结果
        this.updateMergePreviewThrottled = this.throttle(this.updateMergePreview.bind(this), 300);

        this.initializeUI();
        this.attachEventListeners();
    }

    initializeUI() {
        this.elements = {
            uploadZone: document.getElementById('uploadZone'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),
            actionButtons: document.getElementById('actionButtons'),
            compareBtn: document.getElementById('compareBtn'),
            clearBtn: document.getElementById('clearBtn'),
            uploadSection: document.getElementById('uploadSection'),
            resultSection: document.getElementById('resultSection'),
            fileTabs: document.getElementById('fileTabs'),
            diffViewer: document.getElementById('diffViewer'),
            mergePreview: document.getElementById('mergePreview'),
            exportBtn: document.getElementById('exportBtn'),
            resetBtn: document.getElementById('resetBtn'),
            statsBar: document.getElementById('statsBar')
        };
    }

    attachEventListeners() {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        this.elements.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadZone.classList.add('dragover');
        });
        
        this.elements.uploadZone.addEventListener('dragleave', () => {
            this.elements.uploadZone.classList.remove('dragover');
        });
        
        this.elements.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadZone.classList.remove('dragover');
            this.handleFileDrop(e);
        });

        this.elements.compareBtn.addEventListener('click', () => this.startComparison());
        this.elements.clearBtn.addEventListener('click', () => this.clearFiles());
        this.elements.exportBtn.addEventListener('click', () => this.exportMergedJSON());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.loadFiles(files);
    }

    handleFileDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        this.loadFiles(files);
    }

    async loadFiles(fileList) {
        // 显示加载提示
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'loading-indicator';
        loadingMsg.textContent = `正在加载 ${fileList.length} 个文件...`;
        this.elements.fileList.appendChild(loadingMsg);

        // 并行加载所有文件
        const loadPromises = Array.from(fileList).map(async (file) => {
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    return {
                        name: file.name,
                        data: data,
                        success: true
                    };
                } catch (error) {
                    console.error(`解析文件 ${file.name} 失败:`, error);
                    return {
                        name: file.name,
                        error: error.message,
                        success: false
                    };
                }
            }
            return null;
        });

        const results = await Promise.all(loadPromises);
        
        // 移除加载提示
        if (loadingMsg.parentNode) {
            loadingMsg.parentNode.removeChild(loadingMsg);
        }

        // 处理结果
        const errors = [];
        results.forEach(result => {
            if (result) {
                if (result.success) {
                    this.files.push({
                        name: result.name,
                        data: result.data
                    });
                } else {
                    errors.push(`${result.name}: ${result.error}`);
                }
            }
        });

        // 显示错误
        if (errors.length > 0) {
            alert(`以下文件加载失败:\n${errors.join('\n')}`);
        }

        this.updateFileList();
        this.updateActionButtons();
    }

    updateFileList() {
        this.elements.fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">📄</span>
                    <span class="file-name">${file.name}</span>
                </div>
                <button class="file-remove" data-index="${index}">删除</button>
            `;

            fileItem.querySelector('.file-remove').addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.removeFile(idx);
            });

            this.elements.fileList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileList();
        this.updateActionButtons();
    }

    updateActionButtons() {
        if (this.files.length >= 2) {
            this.elements.actionButtons.style.display = 'flex';
        } else {
            this.elements.actionButtons.style.display = 'none';
        }
    }

    clearFiles() {
        this.files = [];
        this.updateFileList();
        this.updateActionButtons();
        this.elements.fileInput.value = '';
    }

    startComparison() {
        if (this.files.length < 2) {
            alert('请至少上传 2 个 JSON 文件');
            return;
        }

        // 显示进度提示
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'progress-overlay';
        progressOverlay.innerHTML = `
            <div class="progress-content">
                <div class="progress-spinner"></div>
                <div class="progress-text">正在对比文件...</div>
            </div>
        `;
        document.body.appendChild(progressOverlay);

        // 使用 setTimeout 让UI有时间渲染
        setTimeout(() => {
            try {
                this.diffEngine = new JSONDiff(this.files);
                this.diffResult = this.diffEngine.compare();

                this.mergeEngine = new JSONMerger(this.diffResult.tree, this.files);
                this.mergeEngine.initializeDefaultSelections();

                this.displayResults();
            } catch (error) {
                alert(`对比失败: ${error.message}`);
                console.error(error);
            } finally {
                // 移除进度提示
                if (progressOverlay.parentNode) {
                    progressOverlay.parentNode.removeChild(progressOverlay);
                }
            }
        }, 100);
    }

    displayResults() {
        this.elements.uploadSection.style.display = 'none';
        this.elements.resultSection.style.display = 'block';

        this.displayStats();
        this.createFileHeader();
        this.renderStructuredDiff();
        this.updateMergePreview();
        this.syncScroll();
    }
    
    syncScroll() {
        // 同步标题和内容的横向滚动
        const header = document.querySelector('.file-selector');
        const content = document.querySelector('.github-diff-container');
        
        if (header && content) {
            content.addEventListener('scroll', () => {
                header.scrollLeft = content.scrollLeft;
            });
            
            header.addEventListener('scroll', () => {
                content.scrollLeft = header.scrollLeft;
            });
        }
    }

    displayStats() {
        const stats = this.diffResult.stats;
        
        // 计算行级别的变更统计
        const lineStats = this.calculateLineChanges();
        
        this.elements.statsBar.innerHTML = `
            <div class="github-style-stats">
                <div class="files-changed">
                    <span class="icon">📄</span>
                    <strong>${this.files.length} files</strong> changed
                </div>
                <div class="line-changes">
                    <span class="additions">+${lineStats.additions}</span>
                    <span class="deletions">-${lineStats.deletions}</span>
                    <span class="summary">lines changed</span>
                </div>
            </div>
            <div class="detail-stats">
                <div class="stat-item">
                    <span class="stat-icon">➕</span>
                    <div>
                        <div class="stat-label">新增字段</div>
                        <div class="stat-value" style="color: #2da44e;">${stats.added}</div>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">➖</span>
                    <div>
                        <div class="stat-label">删除字段</div>
                        <div class="stat-value" style="color: #cf222e;">${stats.removed}</div>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">✏️</span>
                    <div>
                        <div class="stat-label">修改字段</div>
                        <div class="stat-value" style="color: #fb8500;">${stats.modified}</div>
                    </div>
                </div>
            </div>
        `;
    }

    calculateLineChanges() {
        let additions = 0;
        let deletions = 0;
        
        // 递归计算所有叶子节点的变更
        const countChanges = (node) => {
            if (!node.children || node.children.length === 0) {
                // 叶子节点
                if (node.status === 'added') {
                    additions++;
                } else if (node.status === 'removed') {
                    deletions++;
                } else if (node.status === 'modified') {
                    // 修改算作一删一增
                    deletions++;
                    additions++;
                }
            } else {
                // 递归子节点
                node.children.forEach(child => countChanges(child));
            }
        };
        
        if (this.diffResult.tree.children) {
            this.diffResult.tree.children.forEach(child => countChanges(child));
        }
        
        return { additions, deletions };
    }

    createFileHeader() {
        this.elements.fileTabs.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'multi-file-header';
        header.style.display = 'grid';
        header.style.gridTemplateColumns = `60px 200px repeat(${this.files.length}, 250px)`;
        
        // 空白占位（对应行号列）
        const spacer1 = document.createElement('div');
        spacer1.className = 'file-column-header';
        spacer1.innerHTML = '<span style="color: #999; font-size: 0.85em;">行号</span>';
        header.appendChild(spacer1);
        
        // 空白占位（对应键名列）
        const spacer2 = document.createElement('div');
        spacer2.className = 'file-column-header';
        spacer2.innerHTML = '<span style="color: #999; font-size: 0.85em;">键名</span>';
        header.appendChild(spacer2);
        
        // 为每个文件添加标题列
        this.files.forEach((file, index) => {
            const fileCol = document.createElement('div');
            fileCol.className = 'file-column-header';
            fileCol.innerHTML = `
                <span class="file-badge">${file.name}</span>
            `;
            header.appendChild(fileCol);
        });
        
        this.elements.fileTabs.appendChild(header);
    }

    renderStructuredDiff() {
        this.elements.diffViewer.innerHTML = '<div class="loading-indicator">正在渲染差异...</div>';
        
        // 收集所有需要渲染的行
        const allLines = [];
        let lineNumber = 1;
        
        // 开始大括号
        allLines.push({ lineNumber: lineNumber++, content: '{', node: null, status: 'unchanged', isStructural: true });
        
        // 收集所有行数据
        this.collectLines(this.diffResult.tree, allLines, lineNumber, 1);
        lineNumber = allLines[allLines.length - 1].lineNumber + 1;
        
        // 结束大括号
        allLines.push({ lineNumber: lineNumber++, content: '}', node: null, status: 'unchanged', isStructural: true });
        
        // 增量渲染（每批50行）
        this.renderInBatches(allLines, 50);
    }
    
    collectLines(node, lines, lineNumber, indent) {
        if (!node.children || node.children.length === 0) {
            return lineNumber;
        }

        const indentStr = '  '.repeat(indent);
        
        node.children.forEach((child, index) => {
            const isLast = index === node.children.length - 1;
            const hasChildren = child.children && child.children.length > 0;
            
            if (hasChildren) {
                const openBracket = child.type === 'array' ? '[' : '{';
                const closeBracket = child.type === 'array' ? ']' : '}';
                
                lines.push({
                    lineNumber: lineNumber++,
                    content: `${indentStr}"${child.key}": ${openBracket}`,
                    node: null,
                    status: child.status,
                    isStructural: true
                });
                
                lineNumber = this.collectLines(child, lines, lineNumber, indent + 1);
                
                const comma = isLast ? '' : ',';
                lines.push({
                    lineNumber: lineNumber++,
                    content: `${indentStr}${closeBracket}${comma}`,
                    node: null,
                    status: child.status,
                    isStructural: true
                });
            } else {
                const comma = isLast ? '' : ',';
                lines.push({
                    lineNumber: lineNumber++,
                    content: `${indentStr}"${child.key}":`,
                    node: child,
                    status: child.status,
                    isStructural: false,
                    comma: comma
                });
            }
        });
        
        return lineNumber;
    }
    
    renderInBatches(lines, batchSize) {
        this.elements.diffViewer.innerHTML = '';
        let index = 0;
        
        const renderBatch = () => {
            const end = Math.min(index + batchSize, lines.length);
            const fragment = document.createDocumentFragment();
            
            for (let i = index; i < end; i++) {
                const line = lines[i];
                const lineEl = this.createQuickLineElement(
                    line.lineNumber,
                    line.content,
                    line.node,
                    line.status,
                    line.isStructural,
                    line.comma || ''
                );
                fragment.appendChild(lineEl);
            }
            
            this.elements.diffViewer.appendChild(fragment);
            index = end;
            
            if (index < lines.length) {
                // 继续下一批
                requestAnimationFrame(renderBatch);
            }
        };
        
        renderBatch();
    }
    
    createQuickLineElement(lineNumber, content, node, status, isStructural, comma = '') {
        const lineContainer = document.createElement('div');
        lineContainer.className = `multi-file-line ${status}`;
        lineContainer.style.display = 'grid';
        lineContainer.style.gridTemplateColumns = `60px 200px repeat(${this.files.length}, 250px)`;
        
        // 根据状态添加行背景色
        if (node && !isStructural) {
            if (status === 'added') {
                lineContainer.style.backgroundColor = '#e6ffed';
                lineContainer.style.borderLeft = '3px solid #2da44e';
            } else if (status === 'removed') {
                lineContainer.style.backgroundColor = '#ffebe9';
                lineContainer.style.borderLeft = '3px solid #cf222e';
            } else if (status === 'modified') {
                lineContainer.style.backgroundColor = '#fff8c5';
                lineContainer.style.borderLeft = '3px solid #fb8500';
            }
        }
        
        const lineNum = document.createElement('div');
        lineNum.className = 'line-number';
        lineNum.textContent = lineNumber;
        lineContainer.appendChild(lineNum);
        
        const keyPart = document.createElement('div');
        keyPart.className = 'line-key';
        keyPart.textContent = content;
        lineContainer.appendChild(keyPart);
        
        if (isStructural || !node) {
            this.files.forEach(() => {
                const emptyCol = document.createElement('div');
                emptyCol.className = 'file-value-column';
                lineContainer.appendChild(emptyCol);
            });
        } else {
            const existingValues = node.sources
                .filter(s => s.exists)
                .map(s => this.formatValue(s.value));
            
            const hasMultipleValues = new Set(existingValues).size > 1;
            const baseValue = hasMultipleValues ? this.findMostCommonValue(existingValues) : null;
            
            this.files.forEach((file, fileIndex) => {
                const source = node.sources[fileIndex];
                const valueCol = document.createElement('div');
                valueCol.className = 'file-value-column';
                
                if (source.exists) {
                    const value = this.formatValue(source.value);
                    const valueBtn = document.createElement('button');
                    valueBtn.className = 'value-option-btn';
                    
                    if (hasMultipleValues) {
                        // 找出所有不同的值
                        const uniqueValues = [...new Set(existingValues)];
                        
                        if (uniqueValues.length > 1) {
                            // 使用多文件diff对比（绿色=相同，红色=不同）
                            const htmlResult = this.highlightDifferences(value, existingValues);
                            valueBtn.innerHTML = htmlResult;
                            valueBtn.classList.add('has-diff');
                        } else {
                            // 实际上所有值相同 - 全绿
                            valueBtn.innerHTML = `<span class="text-same">${this.escapeHtml(value)}</span>`;
                            valueBtn.classList.add('all-same');
                        }
                    } else {
                        // 所有文件值相同 - 全绿
                        valueBtn.innerHTML = `<span class="text-same">${this.escapeHtml(value)}</span>`;
                        valueBtn.classList.add('all-same');
                    }
                    
                    valueBtn.title = `${source.fileName}: ${value}`;
                    
                    const currentSelection = this.mergeEngine.getSelection(node.path);
                    if (currentSelection === fileIndex) {
                        valueBtn.classList.add('selected');
                    }
                    
                    valueBtn.addEventListener('click', () => {
                        this.selectValueForPath(node.path, fileIndex, lineContainer);
                    });
                    
                    valueCol.appendChild(valueBtn);
                } else {
                    valueCol.innerHTML = '<span class="empty-value">-</span>';
                }
                
                if (fileIndex === this.files.length - 1 && comma) {
                    const commaSpan = document.createElement('span');
                    commaSpan.textContent = comma;
                    commaSpan.style.marginLeft = '5px';
                    valueCol.appendChild(commaSpan);
                }
                
                lineContainer.appendChild(valueCol);
            });
        }
        
        return lineContainer;
    }


    renderNode(node, lineNumber, indent) {
        if (!node.children || node.children.length === 0) {
            return lineNumber;
        }

        const indentStr = '  '.repeat(indent);
        
        node.children.forEach((child, index) => {
            const isLast = index === node.children.length - 1;
            const hasChildren = child.children && child.children.length > 0;
            
            if (hasChildren) {
                // 对象或数组类型
                const openBracket = child.type === 'array' ? '[' : '{';
                const closeBracket = child.type === 'array' ? ']' : '}';
                
                // 键名 + 开括号
                this.renderLine(
                    lineNumber++,
                    `${indentStr}"${child.key}": ${openBracket}`,
                    null,
                    child.status,
                    true
                );
                
                // 递归渲染子节点
                lineNumber = this.renderNode(child, lineNumber, indent + 1);
                
                // 闭括号
                const comma = isLast ? '' : ',';
                this.renderLine(
                    lineNumber++,
                    `${indentStr}${closeBracket}${comma}`,
                    null,
                    child.status,
                    true
                );
            } else {
                // 叶子节点（实际的值）
                const comma = isLast ? '' : ',';
                this.renderLine(
                    lineNumber++,
                    `${indentStr}"${child.key}":`,
                    child,
                    child.status,
                    false,
                    comma
                );
            }
        });
        
        return lineNumber;
    }


    renderLine(lineNumber, content, node, status, isStructural, comma = '') {
        const lineContainer = document.createElement('div');
        lineContainer.className = `multi-file-line ${status}`;
        lineContainer.style.display = 'grid';
        lineContainer.style.gridTemplateColumns = `60px 200px repeat(${this.files.length}, 250px)`;
        
        // 根据状态添加行背景色
        if (node && !isStructural) {
            if (status === 'added') {
                lineContainer.style.backgroundColor = '#e6ffed';
                lineContainer.style.borderLeft = '3px solid #2da44e';
            } else if (status === 'removed') {
                lineContainer.style.backgroundColor = '#ffebe9';
                lineContainer.style.borderLeft = '3px solid #cf222e';
            } else if (status === 'modified') {
                lineContainer.style.backgroundColor = '#fff8c5';
                lineContainer.style.borderLeft = '3px solid #fb8500';
            }
        }
        
        // 行号
        const lineNum = document.createElement('div');
        lineNum.className = 'line-number';
        lineNum.textContent = lineNumber;
        lineContainer.appendChild(lineNum);
        
        // 键名/结构部分
        const keyPart = document.createElement('div');
        keyPart.className = 'line-key';
        keyPart.textContent = content;
        lineContainer.appendChild(keyPart);
        
        if (isStructural || !node) {
            // 结构性行（大括号、中括号等），为每个文件列添加空单元格
            this.files.forEach(() => {
                const emptyCol = document.createElement('div');
                emptyCol.className = 'file-value-column';
                lineContainer.appendChild(emptyCol);
            });
        } else {
            // 值行，为每个文件创建值列
            // 先收集所有存在的值用于diff对比
            const existingValues = node.sources
                .filter(s => s.exists)
                .map(s => this.formatValue(s.value));
            
            // 检查是否有差异
            const hasMultipleValues = new Set(existingValues).size > 1;
            const baseValue = hasMultipleValues ? this.findMostCommonValue(existingValues) : null;
            
            // 调试日志
            if (hasMultipleValues) {
                console.log('Path:', node.path);
                console.log('Values:', existingValues);
                console.log('Base:', baseValue);
            }
            
            this.files.forEach((file, fileIndex) => {
                const source = node.sources[fileIndex];
                const valueCol = document.createElement('div');
                valueCol.className = 'file-value-column';
                
                if (source.exists) {
                    const value = this.formatValue(source.value);
                    const valueBtn = document.createElement('button');
                    valueBtn.className = 'value-option-btn';
                    
                    // 如果有差异，对每个值都进行diff标注
                    if (hasMultipleValues && baseValue) {
                        if (value === baseValue) {
                            // 基准值，不显示diff
                            valueBtn.textContent = value;
                            valueBtn.classList.add('is-base-value');
                        } else {
                            // 使用缓存的diff结果
                            const cacheKey = `${baseValue}||${value}`;
                            let diffResult = this.diffCache.get(cacheKey);
                            
                            if (!diffResult) {
                                // 懒加载：只在需要时计算diff
                                diffResult = TextDiff.diff(baseValue, value);
                                this.diffCache.set(cacheKey, diffResult);
                            }
                            
                            valueBtn.innerHTML = diffResult.text2Html;
                            valueBtn.classList.add('has-diff');
                        }
                    } else {
                        // 所有值相同，正常显示
                        valueBtn.textContent = value;
                        valueBtn.classList.add('all-same');
                    }
                    
                    valueBtn.title = `${source.fileName}: ${value}`;
                    
                    // 检查是否被选中
                    const currentSelection = this.mergeEngine.getSelection(node.path);
                    if (currentSelection === fileIndex) {
                        valueBtn.classList.add('selected');
                    }
                    
                    valueBtn.addEventListener('click', () => {
                        this.selectValueForPath(node.path, fileIndex, lineContainer);
                    });
                    
                    valueCol.appendChild(valueBtn);
                } else {
                    valueCol.innerHTML = '<span class="empty-value">-</span>';
                }
                
                // 添加逗号到最后一个值列
                if (fileIndex === this.files.length - 1 && comma) {
                    const commaSpan = document.createElement('span');
                    commaSpan.textContent = comma;
                    commaSpan.style.marginLeft = '5px';
                    valueCol.appendChild(commaSpan);
                }
                
                lineContainer.appendChild(valueCol);
            });
        }
        
        this.elements.diffViewer.appendChild(lineContainer);
    }

    formatValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'boolean') return value.toString();
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    isValueDifferentFromOthers(sources, currentIndex) {
        const currentSource = sources[currentIndex];
        if (!currentSource || !currentSource.exists) return false;
        
        const currentValue = JSON.stringify(currentSource.value);
        
        // 检查是否有其他文件的值与当前值不同
        for (let i = 0; i < sources.length; i++) {
            if (i !== currentIndex && sources[i].exists) {
                const otherValue = JSON.stringify(sources[i].value);
                if (currentValue !== otherValue) {
                    return true;
                }
            }
        }
        
        return false;
    }

    findMostCommonValue(values) {
        const counts = {};
        values.forEach(val => {
            counts[val] = (counts[val] || 0) + 1;
        });
        
        let maxCount = 0;
        let mostCommon = values[0];
        
        for (const [val, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = val;
            }
        }
        
        return mostCommon;
    }

    selectValueForPath(path, fileIndex, lineContainer) {
        this.mergeEngine.setSelection(path, fileIndex);
        
        // 更新按钮状态
        lineContainer.querySelectorAll('.value-option-btn').forEach((btn, idx) => {
            btn.classList.remove('selected');
            if (idx === fileIndex) {
                btn.classList.add('selected');
            }
        });
        
        // 使用节流的更新函数
        this.updateMergePreviewThrottled();
    }

    updateMergePreview() {
        const merged = this.mergeEngine.getMergedResult();
        this.elements.mergePreview.textContent = JSON.stringify(merged, null, 2);
    }

    exportMergedJSON() {
        if (!this.mergeEngine) {
            alert('请先进行对比');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.mergeEngine.downloadJSON(`merged-${timestamp}.json`);
    }

    // 节流函数 - 限制函数执行频率
    throttle(func, wait) {
        let timeout = null;
        let previous = 0;
        
        return function(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);
            
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    reset() {
        this.files = [];
        this.diffEngine = null;
        this.mergeEngine = null;
        this.diffResult = null;
        this.diffCache.clear(); // 清空缓存

        this.elements.resultSection.style.display = 'none';
        this.elements.uploadSection.style.display = 'block';

        this.clearFiles();
    }
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 高亮差异：绿色=相同，红色=不同
    highlightDifferences(currentValue, allValues) {
        const otherValues = allValues.filter(v => v !== currentValue);
        if (otherValues.length === 0) {
            // 全部相同 - 全绿
            return `<span class="text-same">${this.escapeHtml(currentValue)}</span>`;
        }
        
        // 找出在所有其他值中都出现的字符（相同部分）
        const currentStr = String(currentValue);
        const chars = currentStr.split('');
        let result = '';
        
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            // 检查这个字符在相同位置是否在所有其他值中都存在
            const isSame = otherValues.every(otherVal => {
                const otherStr = String(otherVal);
                return otherStr.length > i && otherStr[i] === char;
            });
            
            if (isSame) {
                // 绿色 - 相同
                result += `<span class="text-same">${this.escapeHtml(char)}</span>`;
            } else {
                // 红色 - 不同
                result += `<span class="text-diff">${this.escapeHtml(char)}</span>`;
            }
        }
        
        return result;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new JSONDiffApp();
});
