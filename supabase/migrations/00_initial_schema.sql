-- ============================================
-- 00_initial_schema.sql
-- Complete database schema (consolidated)
-- ============================================
-- This file represents the FINAL state of the database schema.
-- It is suitable for deploying to new environments from scratch.
--
-- Tables:
--   payment_methods, transactions, coupons, supplies_costs, fixed_costs,
--   points_platforms, purchase_platforms, selling_platforms,
--   sales_records, return_records
--
-- Views:
--   upcoming_payments
--
-- Key triggers:
--   set_user_id() - auto-set user_id on insert
--   update_transaction_quantity_sold() - sync quantity_sold from sales_records
--   update_transaction_status() - auto-manage in_stock/sold status
--   update_transaction_quantity_returned() - sync quantity_returned from return_records
-- ============================================

-- ============================================
-- PART 1: Base Tables
-- ============================================

-- 1.1 payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'card' CHECK (type IN ('card', 'bank', 'wallet')),
  closing_day INTEGER,
  payment_day INTEGER,
  payment_same_month BOOLEAN NOT NULL DEFAULT false,
  point_rate NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'fixed_amount' CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_purchase_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_date DATE,
  platform TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 supplies_costs
CREATE TABLE IF NOT EXISTS supplies_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplies_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own supplies costs"
ON supplies_costs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplies costs"
ON supplies_costs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplies costs"
ON supplies_costs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplies costs"
ON supplies_costs FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_supplies_costs_user_id ON supplies_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_supplies_costs_purchase_date ON supplies_costs(purchase_date);

-- 1.4 fixed_costs
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fixed costs"
ON fixed_costs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fixed costs"
ON fixed_costs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fixed costs"
ON fixed_costs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fixed costs"
ON fixed_costs FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_user_id ON fixed_costs(user_id);

-- ============================================
-- PART 2: Points Platforms
-- ============================================

CREATE TABLE IF NOT EXISTS points_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  yen_conversion_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO points_platforms (name, display_name, yen_conversion_rate, description) VALUES
  ('paypay', 'PayPay ポイント', 1.0, 'PayPay积分，1积分=1日元'),
  ('vpoint', 'V ポイント', 1.0, '三井住友V Point，1积分=1日元'),
  ('rakuten', '楽天ポイント', 1.0, '楽天积分，1积分=1日元'),
  ('dpoint', 'd ポイント', 1.0, 'dポイント，1积分=1日元'),
  ('tpoint', 'T ポイント', 1.0, 'Tポイント，1积分=1日元'),
  ('ponta', 'Ponta ポイント', 1.0, 'Pontaポイント，1积分=1日元'),
  ('generic_card_1to1', '信用卡积分 (1:1)', 1.0, '通用信用卡积分，1积分=1日元'),
  ('amazon', 'Amazon ポイント', 1.0, 'Amazonポイント，1积分=1日元')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE points_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view points platforms"
  ON points_platforms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_points_platforms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_points_platforms_updated_at
  BEFORE UPDATE ON points_platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_points_platforms_updated_at();

CREATE INDEX IF NOT EXISTS idx_points_platforms_name ON points_platforms(name);
CREATE INDEX IF NOT EXISTS idx_points_platforms_active ON points_platforms(is_active);

-- Add points platform FK to payment_methods
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS card_points_platform_id UUID REFERENCES points_platforms(id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_card_points_platform
ON payment_methods(card_points_platform_id);

-- ============================================
-- PART 3: Purchase & Selling Platforms
-- ============================================

-- 3.1 purchase_platforms
CREATE TABLE IF NOT EXISTS purchase_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO purchase_platforms (name, is_builtin, is_active) VALUES
  ('Amazon', true, true),
  ('楽天市場', true, true),
  ('Yahoo!ショッピング', true, true),
  ('ビックカメラ.com', true, true),
  ('ヨドバシ.com', true, true),
  ('Apple', true, true)
ON CONFLICT DO NOTHING;

ALTER TABLE purchase_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view built-in and own purchase platforms"
  ON purchase_platforms FOR SELECT
  TO authenticated
  USING (is_builtin = true OR user_id = auth.uid());

CREATE POLICY "Users can insert their own purchase platforms"
  ON purchase_platforms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_builtin = false);

CREATE POLICY "Users can update their own purchase platforms"
  ON purchase_platforms FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Users can delete their own purchase platforms"
  ON purchase_platforms FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND is_builtin = false);

CREATE INDEX IF NOT EXISTS idx_purchase_platforms_user_id ON purchase_platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_platforms_builtin ON purchase_platforms(is_builtin);

CREATE OR REPLACE FUNCTION update_purchase_platforms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_platforms_updated_at
  BEFORE UPDATE ON purchase_platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_platforms_updated_at();

-- 3.2 selling_platforms
CREATE TABLE IF NOT EXISTS selling_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO selling_platforms (name, is_builtin, is_active) VALUES
  ('買取一丁目', true, true),
  ('森森買取', true, true),
  ('買取商店', true, true),
  ('メルカリ', true, true)
ON CONFLICT DO NOTHING;

ALTER TABLE selling_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view built-in and own selling platforms"
  ON selling_platforms FOR SELECT
  TO authenticated
  USING (is_builtin = true OR user_id = auth.uid());

CREATE POLICY "Users can insert their own selling platforms"
  ON selling_platforms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_builtin = false);

CREATE POLICY "Users can update their own selling platforms"
  ON selling_platforms FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Users can delete their own selling platforms"
  ON selling_platforms FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND is_builtin = false);

CREATE INDEX IF NOT EXISTS idx_selling_platforms_user_id ON selling_platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_selling_platforms_builtin ON selling_platforms(is_builtin);

CREATE OR REPLACE FUNCTION update_selling_platforms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_selling_platforms_updated_at
  BEFORE UPDATE ON selling_platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_selling_platforms_updated_at();

-- ============================================
-- PART 4: Transactions Table (final schema)
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('pending', 'in_stock', 'awaiting_payment', 'sold', 'returned')),

  -- Purchase info
  purchase_price_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10, 2),
  card_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  point_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  balance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  card_id UUID REFERENCES payment_methods(id),
  purchase_platform_id UUID REFERENCES purchase_platforms(id),
  jan_code TEXT,
  order_number TEXT,

  -- Quantity tracking
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  quantity_sold INTEGER DEFAULT 0 CHECK (quantity_sold >= 0),
  quantity_returned INTEGER DEFAULT 0 CHECK (quantity_returned >= 0),
  quantity_in_stock INTEGER GENERATED ALWAYS AS (quantity - quantity_sold - quantity_returned) STORED,

  -- Profit (aggregated from sales_records, managed by TypeScript)
  cash_profit NUMERIC(10, 2),
  roi NUMERIC(10, 2),
  total_profit NUMERIC(10, 2),

  -- Points
  expected_platform_points NUMERIC(10, 2) DEFAULT 0,
  expected_card_points NUMERIC(10, 2) DEFAULT 0,
  extra_platform_points NUMERIC(10, 2) DEFAULT 0,
  platform_points_platform_id UUID REFERENCES points_platforms(id),
  card_points_platform_id UUID REFERENCES points_platforms(id),
  extra_platform_points_platform_id UUID REFERENCES points_platforms(id),

  -- Payment scheduling
  expected_payment_date DATE,

  -- Return info (legacy, per-unit returns tracked in return_records)
  return_date DATE,
  return_amount NUMERIC(10, 2),
  return_notes TEXT,
  points_deducted NUMERIC(10, 2),

  -- Other
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_quantity_in_stock ON transactions(quantity_in_stock);
CREATE INDEX IF NOT EXISTS idx_transactions_purchase_platform ON transactions(purchase_platform_id);
CREATE INDEX IF NOT EXISTS idx_transactions_jan_code ON transactions(jan_code);
CREATE INDEX IF NOT EXISTS idx_transactions_platform_points_platform ON transactions(platform_points_platform_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_points_platform ON transactions(card_points_platform_id);
CREATE INDEX IF NOT EXISTS idx_transactions_extra_platform_points_platform ON transactions(extra_platform_points_platform_id);

COMMENT ON COLUMN transactions.status IS '取引ステータス: pending=未着, in_stock=在庫中, awaiting_payment=入金待ち, sold=売却済, returned=返品済';
COMMENT ON COLUMN transactions.jan_code IS 'JAN码（商品条形码）';
COMMENT ON COLUMN transactions.unit_price IS '商品単価';
COMMENT ON COLUMN transactions.purchase_platform_id IS '仕入先プラットフォームID';
COMMENT ON COLUMN transactions.order_number IS '注文番号';
COMMENT ON COLUMN transactions.quantity IS '商品総数量';
COMMENT ON COLUMN transactions.quantity_sold IS '販売済数量';
COMMENT ON COLUMN transactions.quantity_returned IS '返品済数量（return_records から集計）';
COMMENT ON COLUMN transactions.quantity_in_stock IS '在庫数量（計算フィールド: quantity - quantity_sold - quantity_returned）';
COMMENT ON COLUMN transactions.total_profit IS '総利益（現金利益 + ポイント価値）';
COMMENT ON COLUMN transactions.cash_profit IS '現金利益（ポイント価値を除く）';

-- ============================================
-- PART 5: User Authentication and RLS
-- ============================================

-- 5.1 Add user_id columns
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5.2 Indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);

-- 5.3 Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- 5.4 RLS Policies for payment_methods
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

-- 5.5 RLS Policies for transactions
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

-- 5.6 RLS Policies for coupons
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

-- 5.7 Auto-set user_id function and triggers
DROP FUNCTION IF EXISTS set_user_id() CASCADE;

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
-- PART 6: Sales Records
-- ============================================

CREATE TABLE IF NOT EXISTS sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sales information
  quantity_sold INTEGER NOT NULL CHECK (quantity_sold > 0),
  selling_price_per_unit DECIMAL(10, 2) NOT NULL CHECK (selling_price_per_unit >= 0),
  platform_fee DECIMAL(10, 2) DEFAULT 0 CHECK (platform_fee >= 0),
  shipping_fee DECIMAL(10, 2) DEFAULT 0 CHECK (shipping_fee >= 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  selling_platform_id UUID REFERENCES selling_platforms(id),
  sale_order_number TEXT,

  -- Calculated fields
  total_selling_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_sold * selling_price_per_unit) STORED,
  cash_profit DECIMAL(10, 2),
  total_profit DECIMAL(10, 2),
  roi DECIMAL(10, 2),
  actual_cash_spent DECIMAL(10, 2),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_records_transaction_id ON sales_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_user_id ON sales_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_sale_date ON sales_records(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_records_selling_platform ON sales_records(selling_platform_id);

ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sales records"
ON sales_records FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own sales records"
ON sales_records FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own sales records"
ON sales_records FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own sales records"
ON sales_records FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE sales_records IS '販売記録テーブル - バッチ商品の個別販売を追跡';
COMMENT ON COLUMN sales_records.selling_platform_id IS '販売先プラットフォームID';
COMMENT ON COLUMN sales_records.sale_order_number IS '販売注文番号';

-- 6.1 Trigger: auto-update quantity_sold on transactions
CREATE OR REPLACE FUNCTION update_transaction_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE transactions
  SET quantity_sold = (
    SELECT COALESCE(SUM(quantity_sold), 0)
    FROM sales_records
    WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
  )
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_quantity_sold_on_insert ON sales_records;
CREATE TRIGGER trigger_update_quantity_sold_on_insert
  AFTER INSERT ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_quantity_sold();

DROP TRIGGER IF EXISTS trigger_update_quantity_sold_on_update ON sales_records;
CREATE TRIGGER trigger_update_quantity_sold_on_update
  AFTER UPDATE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_quantity_sold();

DROP TRIGGER IF EXISTS trigger_update_quantity_sold_on_delete ON sales_records;
CREATE TRIGGER trigger_update_quantity_sold_on_delete
  AFTER DELETE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_quantity_sold();

-- 6.2 Trigger: auto-update transaction status (in_stock <-> sold)
-- Respects 'pending' and 'returned' statuses (managed elsewhere)
CREATE OR REPLACE FUNCTION update_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
  trans_status TEXT;
BEGIN
  SELECT quantity, status INTO trans_quantity, trans_status
  FROM transactions
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  -- Don't auto-change 'pending', 'returned', or 'sold' (user-confirmed statuses)
  IF trans_status IN ('pending', 'returned', 'sold') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate directly from sales_records (avoid race condition)
  SELECT COALESCE(SUM(quantity_sold), 0) INTO trans_quantity_sold
  FROM sales_records
  WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  IF trans_quantity_sold >= trans_quantity THEN
    -- 全部售出时，自动设为 awaiting_payment（而非 sold）
    UPDATE transactions
    SET status = 'awaiting_payment'
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id)
      AND status != 'sold'; -- 不降级已确认的 sold
  ELSE
    -- 部分售出或未售出时，设为 in_stock
    UPDATE transactions
    SET status = 'in_stock'
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_transaction_status() IS '自動ステータス更新 - pending/returned/sold は手動管理、in_stock/awaiting_payment は sales_records から自動判定';

DROP TRIGGER IF EXISTS trigger_update_status_on_sale ON sales_records;
CREATE TRIGGER trigger_update_status_on_sale
  AFTER INSERT OR UPDATE OR DELETE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_status();

-- ============================================
-- PART 7: Return Records
-- ============================================

CREATE TABLE IF NOT EXISTS return_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Return information
  quantity_returned INTEGER NOT NULL CHECK (quantity_returned > 0),
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_amount NUMERIC(10, 2) DEFAULT 0,
  points_deducted NUMERIC(10, 2) DEFAULT 0,
  return_reason TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_records_transaction_id ON return_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_return_records_user_id ON return_records(user_id);
CREATE INDEX IF NOT EXISTS idx_return_records_return_date ON return_records(return_date);

ALTER TABLE return_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own return records"
ON return_records FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own return records"
ON return_records FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own return records"
ON return_records FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own return records"
ON return_records FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION update_return_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_return_records_updated_at
  BEFORE UPDATE ON return_records
  FOR EACH ROW
  EXECUTE FUNCTION update_return_records_updated_at();

COMMENT ON TABLE return_records IS '返品記録テーブル - バッチ商品の個別返品を追跡';
COMMENT ON COLUMN return_records.quantity_returned IS '返品数量';
COMMENT ON COLUMN return_records.return_amount IS '返金額';
COMMENT ON COLUMN return_records.points_deducted IS '返品時に差し引かれたポイント';

-- 7.1 Trigger: auto-update quantity_returned and manage 'returned' status
CREATE OR REPLACE FUNCTION update_transaction_quantity_returned()
RETURNS TRIGGER AS $$
DECLARE
  trans_id UUID;
  new_quantity_returned INTEGER;
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
  trans_status TEXT;
BEGIN
  trans_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT COALESCE(SUM(quantity_returned), 0) INTO new_quantity_returned
  FROM return_records
  WHERE transaction_id = trans_id;

  SELECT quantity, quantity_sold, status INTO trans_quantity, trans_quantity_sold, trans_status
  FROM transactions
  WHERE id = trans_id;

  IF new_quantity_returned > 0 AND (trans_quantity - trans_quantity_sold - new_quantity_returned) <= 0 THEN
    -- All remaining stock returned -> 'returned'
    UPDATE transactions
    SET quantity_returned = new_quantity_returned, status = 'returned'
    WHERE id = trans_id;
  ELSIF trans_status = 'returned' AND (trans_quantity - trans_quantity_sold - new_quantity_returned) > 0 THEN
    -- Return record deleted, stock restored -> 'in_stock'
    UPDATE transactions
    SET quantity_returned = new_quantity_returned, status = 'in_stock'
    WHERE id = trans_id;
  ELSE
    UPDATE transactions
    SET quantity_returned = new_quantity_returned
    WHERE id = trans_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_quantity_returned_on_insert ON return_records;
CREATE TRIGGER trigger_update_quantity_returned_on_insert
  AFTER INSERT ON return_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_quantity_returned();

DROP TRIGGER IF EXISTS trigger_update_quantity_returned_on_update ON return_records;
CREATE TRIGGER trigger_update_quantity_returned_on_update
  AFTER UPDATE ON return_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_quantity_returned();

DROP TRIGGER IF EXISTS trigger_update_quantity_returned_on_delete ON return_records;
CREATE TRIGGER trigger_update_quantity_returned_on_delete
  AFTER DELETE ON return_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_quantity_returned();

-- ============================================
-- PART 8: Views
-- ============================================

-- upcoming_payments: 待付款汇总
DROP VIEW IF EXISTS upcoming_payments CASCADE;

CREATE OR REPLACE VIEW upcoming_payments AS
SELECT
  pm.name AS payment_method_name,
  t.expected_payment_date,
  SUM(t.purchase_price_total - COALESCE(t.point_paid, 0) - COALESCE(t.balance_paid, 0)) AS total_amount,
  COUNT(t.id)::INTEGER AS transaction_count,
  pm.id AS payment_method_id
FROM transactions t
JOIN payment_methods pm ON t.card_id = pm.id
WHERE t.user_id = auth.uid()
  AND t.expected_payment_date IS NOT NULL
  AND t.expected_payment_date >= CURRENT_DATE
  AND t.status != 'returned'
GROUP BY pm.id, pm.name, t.expected_payment_date
ORDER BY t.expected_payment_date ASC;

COMMENT ON VIEW upcoming_payments IS '支払い予定サマリー - 支払い方法と支払日ごとに集計';

-- ============================================
-- PART 9: Storage Bucket for Receipts
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload receipt images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Users can view receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view receipt images" ON storage.objects;

CREATE POLICY "Public can view receipt images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

CREATE POLICY "Users can delete receipt images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Users can update receipt images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================
-- Schema setup complete!
-- ============================================

-- ============================================
-- PART 5: 清理 generic_card_3to1 积分平台
-- ============================================

UPDATE payment_methods
SET card_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_1to1' LIMIT 1)
WHERE card_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_3to1' LIMIT 1);

UPDATE transactions
SET card_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_1to1' LIMIT 1)
WHERE card_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_3to1' LIMIT 1);

UPDATE transactions
SET platform_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_1to1' LIMIT 1)
WHERE platform_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_3to1' LIMIT 1);

UPDATE transactions
SET extra_platform_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_1to1' LIMIT 1)
WHERE extra_platform_points_platform_id = (SELECT id FROM points_platforms WHERE name = 'generic_card_3to1' LIMIT 1);

DELETE FROM points_platforms WHERE name = 'generic_card_3to1';
