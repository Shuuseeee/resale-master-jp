-- ============================================
-- 07: Admin role system
-- ============================================

-- 1) user_roles 表
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- 仅管理员可读 user_roles（普通用户不可见）
-- 无 INSERT/UPDATE/DELETE policy → 只能通过 SQL 直接操作
CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin')
  );

-- 2) is_admin() 辅助函数
-- SECURITY DEFINER: 以函数定义者身份执行，绕过 user_roles 表的 RLS
-- STABLE: PostgreSQL 在同一语句内缓存结果，避免每行都查一次
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3) 替换 coupons RLS policies
DROP POLICY IF EXISTS "Users can view their own coupons" ON coupons;
CREATE POLICY "Users can view own coupons or admin sees all"
  ON coupons FOR SELECT
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can update their own coupons" ON coupons;
CREATE POLICY "Users can update own coupons or admin updates all"
  ON coupons FOR UPDATE
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can delete their own coupons" ON coupons;
CREATE POLICY "Users can delete own coupons or admin deletes all"
  ON coupons FOR DELETE
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- INSERT 不变：管理员也只能以自己身份插入，set_user_id 触发器自动设 user_id

-- 4) 替换 coupon_usage_history SELECT policy
DROP POLICY IF EXISTS "Users can view own coupon usage history" ON coupon_usage_history;
CREATE POLICY "Users can view own usage or admin sees all"
  ON coupon_usage_history FOR SELECT
  USING (auth.uid() = user_id OR (SELECT public.is_admin()));

-- INSERT 不变
