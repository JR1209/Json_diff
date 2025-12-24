/**
 * JSON Diff 引擎
 * 负责计算多个 JSON 文件之间的结构化差异
 */

class JSONDiff {
    constructor(jsonFiles) {
        this.files = jsonFiles; // [{ name: 'file1.json', data: {...} }, ...]
        this.diffTree = null;
        this.stats = {
            added: 0,
            removed: 0,
            modified: 0,
            unchanged: 0
        };
        this.keyOrder = new Map(); // 记录键的原始顺序
    }

    /**
     * 主入口：计算所有文件的差异
     */
    compare() {
        if (this.files.length < 2) {
            throw new Error('至少需要 2 个 JSON 文件进行对比');
        }

        console.time('收集路径');
        // 收集所有文件中的所有路径
        const allPaths = this.collectAllPaths();
        console.timeEnd('收集路径');
        console.log(`总路径数: ${allPaths.size}`);
        
        console.time('构建差异树');
        // 构建差异树
        this.diffTree = this.buildDiffTree(allPaths);
        console.timeEnd('构建差异树');
        
        return {
            tree: this.diffTree,
            stats: this.stats
        };
    }

    /**
     * 收集所有文件中出现的所有路径（优化版）
     */
    collectAllPaths() {
        const pathMap = new Map();
        const fileCount = this.files.length;

        // 并行遍历所有文件
        this.files.forEach((file, fileIndex) => {
            this.traverseJSON(file.data, '', (path, value) => {
                if (!pathMap.has(path)) {
                    // 预分配数组，避免动态扩展
                    pathMap.set(path, new Array(fileCount));
                }
                const sources = pathMap.get(path);
                sources[fileIndex] = {
                    fileIndex,
                    fileName: file.name,
                    value: value,
                    exists: true
                };
            });
        });

        // 补充缺失的文件（某些文件中不存在的路径）
        pathMap.forEach((sources, path) => {
            for (let i = 0; i < fileCount; i++) {
                if (!sources[i]) {
                    sources[i] = {
                        fileIndex: i,
                        fileName: this.files[i].name,
                        value: undefined,
                        exists: false
                    };
                }
            }
        });

        return pathMap;
    }

    /**
     * 递归遍历 JSON 对象
     */
    traverseJSON(obj, currentPath, callback) {
        if (obj === null || obj === undefined) {
            callback(currentPath, obj);
            return;
        }

        if (typeof obj !== 'object') {
            callback(currentPath, obj);
            return;
        }

        if (Array.isArray(obj)) {
            callback(currentPath, obj);
            obj.forEach((item, index) => {
                const newPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
                this.traverseJSON(item, newPath, callback);
            });
        } else {
            callback(currentPath, obj);
            // 记录键的顺序 - 使用全局计数器确保顺序唯一
            const keys = Object.keys(obj);
            keys.forEach((key) => {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                if (!this.keyOrder.has(newPath)) {
                    this.keyOrder.set(newPath, this.keyOrder.size);
                }
                this.traverseJSON(obj[key], newPath, callback);
            });
        }
    }

    /**
     * 构建差异树结构（优化版）
     */
    buildDiffTree(pathMap) {
        const tree = {
            key: 'root',
            path: '',
            type: 'object',
            status: 'unchanged',
            children: [],
            sources: [],
            level: 0
        };

        // 按照键的原始顺序排序 - 完全按照第一个文件的顺序
        const sortedPaths = Array.from(pathMap.keys()).sort((a, b) => {
            const orderA = this.keyOrder.get(a);
            const orderB = this.keyOrder.get(b);
            
            // 如果两个路径都有顺序记录，直接比较
            if (orderA !== undefined && orderB !== undefined) {
                return orderA - orderB;
            }
            
            // 否则按字母顺序
            return a.localeCompare(b);
        });
        
        // 批量处理节点，减少函数调用开销
        const nodesToInsert = [];
        sortedPaths.forEach(path => {
            if (!path) return; // 跳过根路径
            
            const sources = pathMap.get(path);
            const node = this.createNodeFromPath(path, sources);
            nodesToInsert.push(node);
        });
        
        // 批量插入节点
        nodesToInsert.forEach(node => {
            this.insertNodeIntoTree(tree, node);
        });

        // 计算每个节点的状态
        this.calculateNodeStatus(tree);

        return tree;
    }

    /**
     * 从路径创建节点
     */
    createNodeFromPath(path, sources) {
        const keys = this.parsePath(path);
        const lastKey = keys[keys.length - 1];
        
        // 判断值类型
        const existingSources = sources.filter(s => s.exists);
        const valueType = existingSources.length > 0 
            ? this.getValueType(existingSources[0].value)
            : 'unknown';

        return {
            key: lastKey,
            path: path,
            type: valueType,
            status: this.determineStatus(sources),
            sources: sources,
            children: [],
            level: keys.length
        };
    }

    /**
     * 解析路径为键数组
     */
    parsePath(path) {
        // 处理 "a.b.c" 和 "a[0].b[1]" 格式
        return path
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .filter(k => k);
    }

    /**
     * 判断值的类型
     */
    getValueType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'string') return 'string';
        return 'unknown';
    }

    /**
     * 确定节点状态（优化版 - 减少遍历）
     */
    determineStatus(sources) {
        let existCount = 0;
        let firstValue = null;
        let allSame = true;
        
        for (const s of sources) {
            if (s.exists) {
                existCount++;
                const strValue = JSON.stringify(s.value);
                if (firstValue === null) {
                    firstValue = strValue;
                } else if (firstValue !== strValue) {
                    allSame = false;
                }
            }
        }

        if (existCount === 0) return 'removed';
        if (existCount === sources.length) {
            return allSame ? 'unchanged' : 'modified';
        }
        
        // 部分文件存在
        return existCount > sources.length / 2 ? 'modified' : 'added';
    }

    /**
     * 将节点插入树中
     */
    insertNodeIntoTree(tree, node) {
        const keys = this.parsePath(node.path);
        let current = tree;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            let child = current.children.find(c => c.key === key);
            
            if (!child) {
                child = {
                    key: key,
                    path: keys.slice(0, i + 1).join('.'),
                    type: 'object',
                    status: 'unchanged',
                    children: [],
                    sources: [],
                    level: i + 1
                };
                current.children.push(child);
            }
            current = child;
        }

        current.children.push(node);
    }

    /**
     * 递归计算节点状态
     */
    calculateNodeStatus(node) {
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => this.calculateNodeStatus(child));

            // 父节点状态基于子节点
            const childStatuses = node.children.map(c => c.status);
            if (childStatuses.every(s => s === 'unchanged')) {
                node.status = 'unchanged';
            } else if (childStatuses.some(s => s === 'added' || s === 'modified' || s === 'removed')) {
                node.status = 'modified';
            }
        }

        // 更新统计
        if (node.path) { // 跳过根节点
            this.stats[node.status]++;
        }
    }

    /**
     * 获取可读的值显示
     */
    static formatValue(value) {
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JSONDiff;
}