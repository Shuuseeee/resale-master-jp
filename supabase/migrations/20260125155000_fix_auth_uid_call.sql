-- 修复 RLS 策略 - 使用正确的 auth.uid() 调用方式
-- Supabase 需要使用 (select auth.uid()) 或确保函数在正确的 schema 中

-- 1. 删除所有现有策略
DROP POLICY IF EXISTS "authenticated_select_own_bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "authenticated_insert_own_bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "authenticated_update_own_bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "authenticated_delete_own_bank_accounts" ON bank_accounts;

DROP POLICY IF EXISTS "authenticated_select_own_payment_methods" ON payment_methods;
DROP POLICY IF EXISTS "authenticated_insert_own_payment_methods" ON payment_methods;
DROP POLICY IF EXISTS "authenticated_update_own_payment_methods" ON payment_methods;
DROP POLICY IF EXISTS "authenticated_delete_own_payment_methods" ON payment_methods;

DROP POLICY IF EXISTS "authenticated_select_own_transactions" ON transactions;
DROP POLICY IF EXISTS "authenticated_insert_own_transactions" ON transactions;
DROP POLICY IF EXISTS "authenticated_update_own_transactions" ON transactions;
DROP POLICY IF EXISTS "authenticated_delete_own_transactions" ON transactions;

DROP POLICY IF EXISTS "authenticated_select_own_coupons" ON coupons;
DROP POLICY IF EXISTS "authenticated_insert_own_coupons" ON coupons;
DROP POLICY IF EXISTS "authenticated_update_own_coupons" ON coupons;
DROP POLICY IF EXISTS "authenticated_delete_own_coupons" ON coupons;

-- 2. 创建新的 RLS 策略 - 使用 (select auth.uid()) 确保正确调用
-- bank_accounts
CREATE POLICY "select_own_bank_accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "insert_own_bank_accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "update_own_bank_accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "delete_own_bank_accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- payment_methods
CREATE POLICY "select_own_payment_methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "insert_own_payment_methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "update_own_payment_methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "delete_own_payment_methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- transactions
CREATE POLICY "select_own_transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "insert_own_transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "update_own_transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "delete_own_transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- coupons
CREATE POLICY "select_own_coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "insert_own_coupons"
  ON coupons FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "update_own_coupons"
  ON coupons FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "delete_own_coupons"
  ON coupons FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
