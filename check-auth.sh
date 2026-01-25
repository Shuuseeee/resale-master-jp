#!/bin/bash

# 检查 Supabase 用户和 Auth 配置

echo "=========================================="
echo "  Supabase 用户和配置检查"
echo "=========================================="
echo ""

export SUPABASE_ACCESS_TOKEN=sbp_db2e5c9ea54836111e44d2992b6bd99a28b2afbf

echo "1️⃣  检查项目连接..."
supabase link --project-ref nionbpkoktgejkqfmlio > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 项目连接成功"
else
    echo "❌ 项目连接失败"
    exit 1
fi

echo ""
echo "2️⃣  检查已注册的用户..."
echo "正在查询用户列表..."

# 使用 Supabase CLI 查询用户
supabase db query "SELECT id, email, email_confirmed_at, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;" --project-ref nionbpkoktgejkqfmlio

echo ""
echo "=========================================="
echo "  分析结果"
echo "=========================================="
echo ""
echo "如果 email_confirmed_at 列为空，说明："
echo "  → 邮箱验证功能仍然启用"
echo "  → 用户无法登录"
echo ""
echo "解决方案："
echo "  1. 访问: https://app.supabase.com/project/nionbpkoktgejkqfmlio/auth/settings"
echo "  2. 取消选中 'Enable email confirmations'"
echo "  3. 保存设置"
echo "  4. 重新注册一个新用户"
echo ""
