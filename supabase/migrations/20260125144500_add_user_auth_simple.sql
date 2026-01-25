-- Migration: Add User Authentication and RLS Policies (Simplified Version)
-- Description: Add user_id fields and RLS policies without modifying existing views

-- ============================================
-- 1. Add user_id columns to existing tables
-- ============================================

ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- 2. Create indexes for better performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);

-- ============================================
-- 3. Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Create RLS Policies for bank_accounts
-- ============================================

DROP POLICY IF EXISTS "Users can view their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can insert their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can delete their own bank accounts" ON bank_accounts;

CREATE POLICY "Users can view their own bank accounts"
ON bank_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank accounts"
ON bank_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank accounts"
ON bank_accounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank accounts"
ON bank_accounts FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 5. Create RLS Policies for payment_methods
-- ============================================

DROP POLICY IF EXISTS "Users can view their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can insert their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can update their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete their own payment methods" ON payment_methods;

CREATE POLICY "Users can view their own payment methods"
ON payment_methods FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
ON payment_methods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
ON payment_methods FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
ON payment_methods FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 6. Create RLS Policies for transactions
-- ============================================

DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

CREATE POLICY "Users can view their own transactions"
ON transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
ON transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
ON transactions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
ON transactions FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 7. Create RLS Policies for coupons
-- ============================================

DROP POLICY IF EXISTS "Users can view their own coupons" ON coupons;
DROP POLICY IF EXISTS "Users can insert their own coupons" ON coupons;
DROP POLICY IF EXISTS "Users can update their own coupons" ON coupons;
DROP POLICY IF EXISTS "Users can delete their own coupons" ON coupons;

CREATE POLICY "Users can view their own coupons"
ON coupons FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coupons"
ON coupons FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coupons"
ON coupons FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coupons"
ON coupons FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 8. Create function to automatically set user_id
-- ============================================

DROP FUNCTION IF EXISTS set_user_id() CASCADE;

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Create triggers for automatic user_id setting
-- ============================================

DROP TRIGGER IF EXISTS set_user_id_bank_accounts ON bank_accounts;
CREATE TRIGGER set_user_id_bank_accounts
  BEFORE INSERT ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_payment_methods ON payment_methods;
CREATE TRIGGER set_user_id_payment_methods
  BEFORE INSERT ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_transactions ON transactions;
CREATE TRIGGER set_user_id_transactions
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_coupons ON coupons;
CREATE TRIGGER set_user_id_coupons
  BEFORE INSERT ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- ============================================
-- 10. Add comments
-- ============================================

COMMENT ON COLUMN bank_accounts.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN payment_methods.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN transactions.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN coupons.user_id IS 'User ID from auth.users - ensures data isolation';

-- Migration completed successfully!
