/**
 * 主控制器 - 多文件并排对比（基于键路径）
 */

class JSONDiffApp {
    constructor() {
        this.files = [];
        this.diffEngine = null;
        this.mergeEngine = null;
        this.diffResult = null;

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
        for (const file of fileList) {
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    this.files.push({
                        name: file.name,
                        data: data
                    });
                } catch (error) {
                    alert(`解析文件 ${file.name} 失败: ${error.message}`);
                }
            }
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

        try {
            this.diffEngine = new JSONDiff(this.files);
            this.diffResult = this.diffEngine.compare();

            this.mergeEngine = new JSONMerger(this.diffResult.tree, this.files);
            this.mergeEngine.initializeDefaultSelections();

            this.displayResults();
        } catch (error) {
            alert(`对比失败: ${error.message}`);
            console.error(error);
        }
    }

    displayResults() {
        this.elements.uploadSection.style.display = 'none';
        this.elements.resultSection.style.display = 'block';

        this.displayStats();
        this.createFileHeader();
        this.renderStructuredDiff();
        this.updateMergePreview();
    }

    displayStats() {
        const stats = this.diffResult.stats;
        this.elements.statsBar.innerHTML = `
            <div class="stat-item">
                <span class="stat-icon">📁</span>
                <div>
                    <div class="stat-label">文件数</div>
                    <div class="stat-value">${this.files.length}</div>
                </div>
            </div>
            <div class="stat-item">
                <span class="stat-icon">➕</span>
                <div>
                    <div class="stat-label">新增</div>
                    <div class="stat-value" style="color: #2ecc71;">${stats.added}</div>
                </div>
            </div>
            <div class="stat-item">
                <span class="stat-icon">➖</span>
                <div>
                    <div class="stat-label">删除</div>
                    <div class="stat-value" style="color: #ff4757;">${stats.removed}</div>
                </div>
            </div>
            <div class="stat-item">
                <span class="stat-icon">✏️</span>
                <div>
                    <div class="stat-label">修改</div>
                    <div class="stat-value" style="color: #ffa726;">${stats.modified}</div>
                </div>
            </div>
        `;
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
        this.elements.diffViewer.innerHTML = '';
        
        // 渲染根节点的所有子节点
        let lineNumber = 1;
        
        // 开始大括号
        this.renderLine(lineNumber++, '{', null, 'unchanged', true);
        
        // 渲染所有字段
        lineNumber = this.renderNode(this.diffResult.tree, lineNumber, 1);
        
        // 结束大括号
        this.renderLine(lineNumber++, '}', null, 'unchanged', true);
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
            this.files.forEach((file, fileIndex) => {
                const source = node.sources[fileIndex];
                const valueCol = document.createElement('div');
                valueCol.className = 'file-value-column';
                
                if (source.exists) {
                    const value = this.formatValue(source.value);
                    const valueBtn = document.createElement('button');
                    valueBtn.className = 'value-option-btn';
                    valueBtn.textContent = value;
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

    selectValueForPath(path, fileIndex, lineContainer) {
        this.mergeEngine.setSelection(path, fileIndex);
        
        // 更新按钮状态
        lineContainer.querySelectorAll('.value-option-btn').forEach((btn, idx) => {
            btn.classList.remove('selected');
            if (idx === fileIndex) {
                btn.classList.add('selected');
            }
        });
        
        this.updateMergePreview();
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

    reset() {
        this.files = [];
        this.diffEngine = null;
        this.mergeEngine = null;
        this.diffResult = null;

        this.elements.resultSection.style.display = 'none';
        this.elements.uploadSection.style.display = 'block';

        this.clearFiles();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new JSONDiffApp();
});
