/**
 * 文本级别的 Diff 算法
 * 类似 Git diff 的行内差异标注
 */

class TextDiff {
    /**
     * 计算两个字符串的差异，返回带标记的HTML
     * @param {string} text1 - 原始文本
     * @param {string} text2 - 新文本
     * @returns {object} - { text1Html, text2Html }
     */
    static diff(text1, text2) {
        if (text1 === text2) {
            return {
                text1Html: this.escapeHtml(text1),
                text2Html: this.escapeHtml(text2),
                hasDiff: false
            };
        }

        // 对于很长的字符串，使用简化的diff算法
        if (text1.length > 200 || text2.length > 200) {
            return this.simpleDiff(text1, text2);
        }

        // 使用最长公共子序列算法
        const lcs = this.longestCommonSubsequence(text1, text2);
        
        const text1Html = this.buildDiffHtml(text1, text2, lcs, 'removed');
        const text2Html = this.buildDiffHtml(text2, text1, lcs, 'added');
        
        return {
            text1Html,
            text2Html,
            hasDiff: true
        };
    }

    /**
     * 计算多个文本之间的差异
     * @param {Array<string>} texts - 文本数组
     * @returns {Array<object>} - 每个文本的差异信息
     */
    static multiDiff(texts) {
        const results = [];
        
        // 找出最常见的值作为基准
        const baseText = this.findMostCommonValue(texts);
        
        texts.forEach(text => {
            if (text === baseText) {
                results.push({
                    html: this.escapeHtml(text),
                    type: 'unchanged'
                });
            } else {
                const diff = this.diff(baseText, text);
                results.push({
                    html: diff.text2Html,
                    type: 'modified'
                });
            }
        });
        
        return results;
    }

    /**
     * 最长公共子序列算法（动态规划）
     */
    static longestCommonSubsequence(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }
        
        // 回溯找出LCS
        const lcs = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (str1[i - 1] === str2[j - 1]) {
                lcs.unshift({ i: i - 1, j: j - 1, char: str1[i - 1] });
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
        
        return lcs;
    }

    /**
     * 构建带差异标记的HTML
     */
    static buildDiffHtml(text, otherText, lcs, diffType) {
        let html = '';
        let textIndex = 0;
        let lcsIndex = 0;
        
        while (textIndex < text.length) {
            if (lcsIndex < lcs.length && 
                ((diffType === 'removed' && lcs[lcsIndex].i === textIndex) ||
                 (diffType === 'added' && lcs[lcsIndex].j === textIndex))) {
                // 公共字符
                html += this.escapeHtml(text[textIndex]);
                lcsIndex++;
                textIndex++;
            } else {
                // 差异字符
                const className = diffType === 'removed' ? 'diff-removed' : 'diff-added';
                html += `<span class="${className}">${this.escapeHtml(text[textIndex])}</span>`;
                textIndex++;
            }
        }
        
        return html;
    }

    /**
     * 找出最常见的值
     */
    static findMostCommonValue(values) {
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

    /**
     * 简化的diff算法（用于长文本）
     */
    static simpleDiff(text1, text2) {
        // 找出前缀和后缀的公共部分
        let prefixLen = 0;
        const minLen = Math.min(text1.length, text2.length);
        
        while (prefixLen < minLen && text1[prefixLen] === text2[prefixLen]) {
            prefixLen++;
        }
        
        let suffixLen = 0;
        while (suffixLen < minLen - prefixLen && 
               text1[text1.length - 1 - suffixLen] === text2[text2.length - 1 - suffixLen]) {
            suffixLen++;
        }
        
        const prefix = this.escapeHtml(text1.substring(0, prefixLen));
        const suffix = this.escapeHtml(text1.substring(text1.length - suffixLen));
        
        const middle1 = text1.substring(prefixLen, text1.length - suffixLen);
        const middle2 = text2.substring(prefixLen, text2.length - suffixLen);
        
        const text1Html = prefix + 
            (middle1 ? `<span class="diff-removed">${this.escapeHtml(middle1)}</span>` : '') + 
            suffix;
            
        const text2Html = prefix + 
            (middle2 ? `<span class="diff-added">${this.escapeHtml(middle2)}</span>` : '') + 
            suffix;
        
        return {
            text1Html,
            text2Html,
            hasDiff: true
        };
    }

    /**
     * HTML转义（优化版 - 使用查找表）
     */
    static escapeHtml(text) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => escapeMap[char]);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextDiff;
}