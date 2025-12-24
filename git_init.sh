#!/bin/bash

# 初始化Git仓库
echo "🔧 初始化 Git 仓库..."
git init

# 添加所有文件
echo "📁 添加文件到暂存区..."
git add .

# 第一次提交
echo "💾 创建初始提交..."
git commit -m "Initial commit: JSON Diff & Merge Tool with multi-file comparison"

# 查看状态
echo "✅ Git 初始化完成！"
echo ""
echo "📊 当前状态:"
git status

echo ""
echo "🎯 下一步操作:"
echo "1. 创建远程仓库（GitHub/GitLab/Gitee）"
echo "2. 添加远程仓库: git remote add origin <your-repo-url>"
echo "3. 推送到远程: git push -u origin main"
echo ""
echo "或者使用以下命令查看当前分支:"
echo "  git branch"