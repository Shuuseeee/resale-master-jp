#!/bin/bash

# 多用户认证系统 - 快速设置脚本
# 此脚本将引导你完成 Supabase 配置

echo "=========================================="
echo "  Resale Master JP - 认证系统设置"
echo "=========================================="
echo ""

# 检查环境变量
if [ -f .env.local ]; then
    echo "✅ 找到环境变量文件 .env.local"
    source .env.local
else
    echo "❌ 错误: 未找到 .env.local 文件"
    exit 1
fi

# 检查 Supabase URL 和 Key
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ 错误: Supabase 环境变量未配置"
    exit 1
else
    echo "✅ Supabase 环境变量已配置"
    echo "   URL: $NEXT_PUBLIC_SUPABASE_URL"
fi

echo ""
echo "=========================================="
echo "  下一步操作指南"
echo "=========================================="
echo ""
echo "1️⃣  运行数据库迁移"
echo "   → 打开 Supabase Dashboard: https://app.supabase.com"
echo "   → 选择你的项目 (nionbpkoktgejkqfmlio)"
echo "   → 点击左侧菜单的 'SQL Editor'"
echo "   → 创建新查询，粘贴以下文件内容:"
echo "      supabase/migrations/add_user_auth.sql"
echo "   → 点击 'RUN' 执行"
echo ""

echo "2️⃣  配置 Auth 设置"
echo "   → 在 Supabase Dashboard 中"
echo "   → 点击 'Authentication' → 'Settings'"
echo "   → 找到 'Email Auth' 部分"
echo "   → 取消选中 'Enable email confirmations'"
echo "   → 点击 'Save'"
echo ""

echo "3️⃣  启动开发服务器"
echo "   → 运行: npm run dev"
echo "   → 访问: http://localhost:3000"
echo ""

echo "=========================================="
echo "  需要帮助?"
echo "=========================================="
echo ""
echo "📖 查看详细文档:"
echo "   - SETUP_AUTH.md (详细设置指南)"
echo "   - IMPLEMENTATION_SUMMARY.md (实施总结)"
echo ""
echo "🔗 Supabase Dashboard:"
echo "   https://app.supabase.com/project/nionbpkoktgejkqfmlio"
echo ""

echo "=========================================="
echo "准备好了吗? (y/n)"
read -p "> " ready

if [ "$ready" = "y" ] || [ "$ready" = "Y" ]; then
    echo ""
    echo "太好了! 现在请按照上面的步骤操作。"
    echo ""
    echo "💡 提示: 你可以在新的终端标签中运行以下命令来查看迁移文件:"
    echo "   cat supabase/migrations/add_user_auth.sql"
    echo ""
fi

echo "完成后，运行 'npm run dev' 启动应用!"
echo ""
