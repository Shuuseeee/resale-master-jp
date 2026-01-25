# 多用户认证系统设置指南

## 实施概述

本项目已成功实现多用户登录验证系统，包含以下功能：
- 用户注册与登录（邮箱+密码）
- 数据隔离（每个用户只能访问自己的数据）
- 路由保护（未登录自动跳转到登录页）
- 会话管理（自动刷新token）

## 已完成的文件

### 1. 数据库迁移
- ✅ `supabase/migrations/add_user_auth.sql` - 添加 user_id 字段和 RLS 策略

### 2. 认证相关
- ✅ `contexts/AuthContext.tsx` - 认证上下文（会话管理）
- ✅ `app/auth/login/page.tsx` - 登录页面
- ✅ `app/auth/register/page.tsx` - 注册页面
- ✅ `middleware.ts` - 路由保护中间件

### 3. 更新的文件
- ✅ `app/layout.tsx` - 添加 AuthProvider
- ✅ `components/Navigation.tsx` - 添加用户信息和登出功能
- ✅ `lib/supabase/client.ts` - 更新认证配置

## 设置步骤

### 第 1 步：运行数据库迁移

在 Supabase Dashboard 中执行以下操作：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"
4. 打开 `supabase/migrations/add_user_auth.sql` 文件
5. 复制所有内容并粘贴到 SQL Editor
6. 点击 "RUN" 执行迁移

**重要提示**：
- 如果某些表（如 `products`, `sales`）在你的数据库中不存在，请删除相关的 ALTER TABLE 和 CREATE POLICY 语句
- 如果迁移失败，请检查错误信息并相应调整

### 第 2 步：配置 Supabase Auth 设置

在 Supabase Dashboard 中配置认证设置：

1. 点击左侧菜单的 "Authentication"
2. 点击 "Settings" 标签
3. 找到 "Email Auth" 部分
4. **禁用邮箱验证**：
   - 取消选中 "Enable email confirmations"
   - 这样用户注册后可以立即登录，无需验证邮箱

5. （可选）配置密码策略：
   - 最小密码长度：6个字符（默认）
   - 可根据需要调整

6. 点击 "Save" 保存设置

### 第 3 步：更新现有数据（如果有）

如果你的数据库中已有数据，需要为现有记录设置 user_id：

```sql
-- 示例：将所有现有数据关联到某个用户
-- 先创建一个测试用户，或使用已有用户的 ID

-- 方法 1：手动指定用户 ID（推荐）
UPDATE bank_accounts SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
UPDATE payment_methods SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
UPDATE transactions SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
UPDATE coupons SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;

-- 方法 2：让触发器自动填充（需要在登录状态下执行）
-- 这个方法不推荐用于迁移现有数据
```

**获取用户 ID 的方法**：
1. 注册一个新账户
2. 在 Supabase Dashboard 中，点击 "Authentication" -> "Users"
3. 找到你的用户并复制 UUID

### 第 4 步：安装依赖包

确保已安装所有必需的 npm 包：

```bash
npm install @supabase/ssr
```

**注意**：我们使用 `@supabase/ssr` 而不是已废弃的 `@supabase/auth-helpers-nextjs`

### 第 5 步：环境变量检查

确保 `.env.local` 文件包含以下变量：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 第 6 步：启动应用

```bash
npm run dev
```

## 测试清单

### ✅ 测试注册功能
1. 访问 `http://localhost:3000/auth/register`
2. 使用任意邮箱格式注册（如 `test@example.com`）
3. 设置密码（至少 6 个字符）
4. 确认注册成功并自动跳转到首页

### ✅ 测试登录功能
1. 访问 `http://localhost:3000/auth/login`
2. 使用注册的邮箱和密码登录
3. 确认登录成功并跳转到首页

### ✅ 测试数据隔离
1. 使用账户 A 创建一些数据（交易、优惠券等）
2. 登出账户 A
3. 注册/登录账户 B
4. 确认账户 B 看不到账户 A 的数据
5. 创建账户 B 的数据
6. 登出并重新登录账户 A
7. 确认账户 A 只能看到自己的数据

### ✅ 测试路由保护
1. 登出所有账户
2. 尝试访问受保护的路由（如 `/dashboard`, `/transactions`）
3. 确认自动重定向到登录页面
4. 登录后确认能够访问这些页面

### ✅ 测试登出功能
1. 在已登录状态下，点击侧边栏的"退出登录"按钮
2. 确认跳转到登录页面
3. 确认无法访问受保护的路由

## 数据库架构变更

### 新增字段
所有主要表都添加了以下字段：
- `user_id UUID` - 外键关联到 `auth.users(id)`

### 受影响的表
- `bank_accounts`
- `payment_methods`
- `transactions`
- `coupons`
- `products` （如果存在）
- `sales` （如果存在）

### RLS (Row Level Security) 策略
每个表都启用了 RLS，并配置了以下策略：
- **SELECT**: 用户只能查看自己的数据
- **INSERT**: 用户只能插入自己的数据
- **UPDATE**: 用户只能更新自己的数据
- **DELETE**: 用户只能删除自己的数据

### 自动触发器
创建了自动设置 `user_id` 的触发器：
- 在插入新记录时，自动填充当前登录用户的 ID
- 无需在应用代码中手动设置 `user_id`

### 视图更新
以下视图已更新以支持多用户：
- `financial_water_level` - 只显示当前用户的财务数据
- `upcoming_payments` - 只显示当前用户的待支付项目
- `pending_points` - 只显示当前用户的待确认积分

## 故障排除

### 问题 1: 登录后看不到数据
**原因**: 可能是现有数据的 `user_id` 为 NULL
**解决方案**: 参考"第 3 步：更新现有数据"

### 问题 2: 中间件导致无限重定向
**原因**: middleware.ts 配置问题
**解决方案**:
- 检查 `publicPaths` 是否包含 `/auth/login` 和 `/auth/register`
- 确保 matcher 配置正确

### 问题 3: 注册后无法自动登录
**原因**: Supabase 邮箱验证未禁用
**解决方案**:
- 在 Supabase Dashboard 中禁用 "Enable email confirmations"
- 重新注册测试

### 问题 4: RLS 策略导致查询失败
**原因**: 用户未登录或 token 过期
**解决方案**:
- 确保用户已登录
- 检查 AuthContext 是否正确包裹应用
- 检查 Supabase 客户端配置

### 问题 5: 迁移脚本执行失败
**原因**: 表或列已存在，或数据库结构不匹配
**解决方案**:
- 检查错误消息
- 删除不存在的表相关的 SQL 语句
- 使用 `IF NOT EXISTS` 和 `IF EXISTS` 子句

## 安全注意事项

1. **密码安全**: Supabase 自动处理密码加密，无需额外配置
2. **Session 管理**: AuthContext 自动处理 session 刷新
3. **RLS 强制执行**: 即使客户端代码有漏洞，RLS 也会在数据库层面保护数据
4. **HTTPS**: 生产环境务必使用 HTTPS
5. **环境变量**: 不要将 `.env.local` 提交到版本控制

## 下一步建议

- [ ] 添加"忘记密码"功能
- [ ] 添加用户个人资料页面
- [ ] 实现邮箱更改功能
- [ ] 添加两步验证（2FA）
- [ ] 实现账户删除功能
- [ ] 添加登录历史记录

## 支持

如有问题，请参考：
- [Supabase 文档](https://supabase.com/docs)
- [Next.js 文档](https://nextjs.org/docs)
- [Supabase Auth 帮助](https://supabase.com/docs/guides/auth)
