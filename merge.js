/**
 * JSON Merge 引擎
 * 负责根据用户选择的值生成合并后的 JSON
 */

class JSONMerger {
    constructor(diffTree, files) {
        this.diffTree = diffTree;
        this.files = files;
        this.selections = new Map(); // path -> selectedFileIndex
        this.mergedResult = {};
    }

    /**
     * 设置用户选择
     */
    setSelection(path, fileIndex) {
        this.selections.set(path, fileIndex);
        this.regenerateMergedJSON();
    }

    /**
     * 获取当前选择
     */
    getSelection(path) {
        return this.selections.get(path);
    }

    /**
     * 初始化默认选择（选择第一个存在的值）
     */
    initializeDefaultSelections(node = this.diffTree) {
        if (!node) return;

        // 如果是叶子节点，设置默认选择
        if (node.sources && node.sources.length > 0) {
            const firstExisting = node.sources.find(s => s.exists);
            if (firstExisting && !this.selections.has(node.path)) {
                this.selections.set(node.path, firstExisting.fileIndex);
            }
        }

        // 递归处理子节点
        if (node.children) {
            node.children.forEach(child => this.initializeDefaultSelections(child));
        }
    }

    /**
     * 重新生成合并后的 JSON
     */
    regenerateMergedJSON() {
        this.mergedResult = {};
        
        // 遍历所有选择，构建结果对象
        this.selections.forEach((fileIndex, path) => {
            const node = this.findNodeByPath(this.diffTree, path);
            if (!node) return;

            const source = node.sources.find(s => s.fileIndex === fileIndex && s.exists);
            if (!source) return;

            this.setValueAtPath(this.mergedResult, path, source.value);
        });

        return this.mergedResult;
    }

    /**
     * 在对象中按路径设置值
     */
    setValueAtPath(obj, path, value) {
        if (!path) {
            return;
        }

        const keys = this.parsePath(path);
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            const nextKey = keys[i + 1];
            
            // 判断下一个键是数字还是字符串
            const isNextArray = !isNaN(parseInt(nextKey));
            
            if (!current[key]) {
                current[key] = isNextArray ? [] : {};
            }
            current = current[key];
        }

        const lastKey = keys[keys.length - 1];
        
        // 只设置原始值（非对象/数组）
        if (typeof value !== 'object' || value === null) {
            current[lastKey] = value;
        }
    }

    /**
     * 解析路径
     */
    parsePath(path) {
        return path
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .filter(k => k);
    }

    /**
     * 根据路径查找节点
     */
    findNodeByPath(node, path) {
        if (node.path === path) {
            return node;
        }

        if (node.children) {
            for (let child of node.children) {
                const found = this.findNodeByPath(child, path);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * 获取合并结果
     */
    getMergedResult() {
        return this.mergedResult;
    }

    /**
     * 导出为格式化的 JSON 字符串
     */
    exportJSON() {
        return JSON.stringify(this.mergedResult, null, 2);
    }

    /**
     * 下载 JSON 文件
     */
    downloadJSON(filename = 'merged-result.json') {
        const jsonStr = this.exportJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 清理所有选择
     */
    clearSelections() {
        this.selections.clear();
        this.mergedResult = {};
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const totalPaths = this.selections.size;
        const fileUsage = new Map();

        this.selections.forEach(fileIndex => {
            fileUsage.set(fileIndex, (fileUsage.get(fileIndex) || 0) + 1);
        });

        return {
            totalPaths,
            fileUsage: Array.from(fileUsage.entries()).map(([fileIndex, count]) => ({
                fileName: this.files[fileIndex]?.name || `File ${fileIndex}`,
                count
            }))
        };
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JSONMerger;
}