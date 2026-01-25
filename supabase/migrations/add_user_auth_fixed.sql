-- Migration: Add User Authentication and RLS Policies (Fixed Version)
-- Description: Add user_id fields to existing tables and implement Row Level Security
-- This version only modifies tables that exist in your database

-- ============================================
-- 1. Add user_id columns to existing tables
-- ============================================

-- Add user_id to bank_accounts table
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to payment_methods table
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to coupons table
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

-- Enable RLS on all tables
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Create RLS Policies for bank_accounts
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can insert their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can delete their own bank accounts" ON bank_accounts;

-- Policy: Users can view their own bank accounts
CREATE POLICY "Users can view their own bank accounts"
ON bank_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own bank accounts
CREATE POLICY "Users can insert their own bank accounts"
ON bank_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bank accounts
CREATE POLICY "Users can update their own bank accounts"
ON bank_accounts
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own bank accounts
CREATE POLICY "Users can delete their own bank accounts"
ON bank_accounts
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 5. Create RLS Policies for payment_methods
-- ============================================

DROP POLICY IF EXISTS "Users can view their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can insert their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can update their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete their own payment methods" ON payment_methods;

CREATE POLICY "Users can view their own payment methods"
ON payment_methods
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
ON payment_methods
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
ON payment_methods
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
ON payment_methods
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 6. Create RLS Policies for transactions
-- ============================================

DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

CREATE POLICY "Users can view their own transactions"
ON transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
ON transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
ON transactions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
ON transactions
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 7. Create RLS Policies for coupons
-- ============================================

DROP POLICY IF EXISTS "Users can view their own coupons" ON coupons;
DROP POLICY IF EXISTS "Users can insert their own coupons" ON coupons;
DROP POLICY IF EXISTS "Users can update their own coupons" ON coupons;
DROP POLICY IF EXISTS "Users can delete their own coupons" ON coupons;

CREATE POLICY "Users can view their own coupons"
ON coupons
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coupons"
ON coupons
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coupons"
ON coupons
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coupons"
ON coupons
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 8. Create function to automatically set user_id
-- ============================================

-- Drop function if exists
DROP FUNCTION IF EXISTS set_user_id() CASCADE;

-- Function to set user_id on insert
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic user_id setting
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
-- 9. Update views to include user_id filtering
-- ============================================

-- Drop and recreate financial_water_level view with user filtering
DROP VIEW IF EXISTS financial_water_level CASCADE;
CREATE VIEW financial_water_level AS
SELECT
  ba.user_id,
  COALESCE(SUM(ba.current_balance), 0) as total_balance,
  (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM transactions t
    WHERE t.user_id = ba.user_id
      AND t.expected_payment_date <= CURRENT_DATE + INTERVAL '30 days'
      AND t.payment_status = 'pending'
  ) as upcoming_payments_30d,
  (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM transactions t
    WHERE t.user_id = ba.user_id
      AND t.expected_payment_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.payment_status = 'pending'
  ) as upcoming_payments_7d,
  (
    SELECT COUNT(*)
    FROM coupons c
    WHERE c.user_id = ba.user_id
      AND c.expiry_date <= CURRENT_DATE + INTERVAL '3 days'
      AND c.is_used = false
  ) as expiring_coupons_3d,
  (
    SELECT COALESCE(SUM(t.expected_platform_points + t.expected_card_points), 0)
    FROM transactions t
    WHERE t.user_id = ba.user_id
      AND t.points_expiry_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.point_status = 'pending'
  ) as expiring_points_7d
FROM bank_accounts ba
WHERE ba.is_active = true
GROUP BY ba.user_id;

-- Drop and recreate upcoming_payments view with user filtering
DROP VIEW IF EXISTS upcoming_payments CASCADE;
CREATE VIEW upcoming_payments AS
SELECT
  t.user_id,
  pm.name as payment_method_name,
  t.expected_payment_date,
  SUM(t.amount) as total_amount,
  COUNT(*) as transaction_count,
  t.payment_method_id
FROM transactions t
JOIN payment_methods pm ON t.payment_method_id = pm.id
WHERE t.payment_status = 'pending'
  AND t.expected_payment_date IS NOT NULL
GROUP BY t.user_id, pm.name, t.expected_payment_date, t.payment_method_id
ORDER BY t.expected_payment_date ASC;

-- Drop and recreate pending_points view with user filtering
DROP VIEW IF EXISTS pending_points CASCADE;
CREATE VIEW pending_points AS
SELECT
  t.id,
  t.user_id,
  t.product_name,
  t.purchase_date,
  t.expected_platform_points,
  t.expected_card_points,
  t.points_expiry_date,
  (t.expected_platform_points + t.expected_card_points) as total_points,
  pm.name as payment_method_name,
  pm.point_conversion_rate,
  CASE
    WHEN t.points_expiry_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'urgent'
    WHEN t.points_expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'warning'
    ELSE 'normal'
  END as urgency_level
FROM transactions t
LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
WHERE t.point_status = 'pending'
  AND (t.expected_platform_points > 0 OR t.expected_card_points > 0)
ORDER BY urgency_level, points_expiry_date;

-- ============================================
-- 10. Add comments
-- ============================================

COMMENT ON COLUMN bank_accounts.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN payment_methods.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN transactions.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN coupons.user_id IS 'User ID from auth.users - ensures data isolation';

-- ============================================
-- Migration completed successfully!
-- ============================================
