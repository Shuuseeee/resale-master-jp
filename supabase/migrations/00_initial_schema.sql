-- ============================================
-- 00_initial_schema.sql
-- Complete database schema definition
-- ============================================
-- This file represents the final state of the database schema.
-- It consolidates all incremental migrations into a single file
-- suitable for deploying to new environments.
--
-- This migration includes:
-- 1. User authentication and RLS (Row Level Security)
-- 2. Points platforms system
-- 3. ROI and profit calculation
-- 4. Storage bucket for receipts
-- 5. Batch inventory management
-- ============================================

-- ============================================
-- PART 1: User Authentication and RLS
-- ============================================

-- 1.1 Add user_id columns to existing tables
-- --------------------------------------------
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1.2 Create indexes for better performance
-- --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);

-- 1.3 Enable Row Level Security (RLS)
-- --------------------------------------------
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- 1.4 Create RLS Policies for bank_accounts
-- --------------------------------------------
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

-- 1.5 Create RLS Policies for payment_methods
-- --------------------------------------------
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

-- 1.6 Create RLS Policies for transactions
-- --------------------------------------------
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

-- 1.7 Create RLS Policies for coupons
-- --------------------------------------------
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

-- 1.8 Create function to automatically set user_id
-- --------------------------------------------
DROP FUNCTION IF EXISTS set_user_id() CASCADE;

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.9 Create triggers for automatic user_id setting
-- --------------------------------------------
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

-- 1.10 Add comments
-- --------------------------------------------
COMMENT ON COLUMN bank_accounts.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN payment_methods.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN transactions.user_id IS 'User ID from auth.users - ensures data isolation';
COMMENT ON COLUMN coupons.user_id IS 'User ID from auth.users - ensures data isolation';

-- ============================================
-- PART 2: Points Platforms System
-- ============================================

-- 2.1 Create points_platforms table
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS points_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- Platform name like "PayPay", "V Point", "楽天ポイント"
  display_name TEXT NOT NULL, -- Display name
  yen_conversion_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0, -- Points to yen conversion rate (1 point = X yen)
  description TEXT, -- Platform description
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Insert default points platforms (including Amazon)
-- --------------------------------------------
INSERT INTO points_platforms (name, display_name, yen_conversion_rate, description) VALUES
  ('paypay', 'PayPay ポイント', 1.0, 'PayPay积分，1积分=1日元'),
  ('vpoint', 'V ポイント', 1.0, '三井住友V Point，1积分=1日元'),
  ('rakuten', '楽天ポイント', 1.0, '楽天积分，1积分=1日元'),
  ('dpoint', 'd ポイント', 1.0, 'dポイント，1积分=1日元'),
  ('tpoint', 'T ポイント', 1.0, 'Tポイント，1积分=1日元'),
  ('ponta', 'Ponta ポイント', 1.0, 'Pontaポイント，1积分=1日元'),
  ('generic_card_3to1', '信用卡积分 (3:1)', 0.3333, '通用信用卡积分，3积分=1日元'),
  ('generic_card_1to1', '信用卡积分 (1:1)', 1.0, '通用信用卡积分，1积分=1日元'),
  ('amazon', 'Amazon ポイント', 1.0, 'Amazonポイント，1积分=1日元')
ON CONFLICT (name) DO NOTHING;

-- 2.3 Add RLS policies for points_platforms
-- --------------------------------------------
ALTER TABLE points_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view points platforms"
  ON points_platforms
  FOR SELECT
  TO authenticated
  USING (true);

-- 2.4 Create updated_at trigger for points_platforms
-- --------------------------------------------
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

-- 2.5 Add indexes for points_platforms
-- --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_points_platforms_name ON points_platforms(name);
CREATE INDEX IF NOT EXISTS idx_points_platforms_active ON points_platforms(is_active);

-- 2.6 Add points platform fields to payment_methods
-- --------------------------------------------
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS card_points_platform_id UUID REFERENCES points_platforms(id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_card_points_platform
ON payment_methods(card_points_platform_id);

COMMENT ON COLUMN payment_methods.card_points_platform_id IS '信用卡/支付方式关联的积分平台ID';

-- 2.7 Add points platform fields to transactions
-- --------------------------------------------
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS platform_points_platform_id UUID REFERENCES points_platforms(id),
ADD COLUMN IF NOT EXISTS card_points_platform_id UUID REFERENCES points_platforms(id),
ADD COLUMN IF NOT EXISTS extra_platform_points NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_platform_points_platform_id UUID REFERENCES points_platforms(id);

CREATE INDEX IF NOT EXISTS idx_transactions_platform_points_platform
ON transactions(platform_points_platform_id);

CREATE INDEX IF NOT EXISTS idx_transactions_card_points_platform
ON transactions(card_points_platform_id);

CREATE INDEX IF NOT EXISTS idx_transactions_extra_platform_points_platform
ON transactions(extra_platform_points_platform_id);

COMMENT ON COLUMN transactions.platform_points_platform_id IS '购物平台积分的平台ID（如楽天、PayPay Mall等）';
COMMENT ON COLUMN transactions.card_points_platform_id IS '信用卡/支付方式积分的平台ID';
COMMENT ON COLUMN transactions.expected_platform_points IS '预期获得的平台积分数量';
COMMENT ON COLUMN transactions.expected_card_points IS '预期获得的信用卡/支付方式积分数量';
COMMENT ON COLUMN transactions.extra_platform_points IS '额外平台积分数量（用于叠加积分场景，如d point）';
COMMENT ON COLUMN transactions.extra_platform_points_platform_id IS '额外平台积分的平台ID';

-- 2.8 Create/update pending_points view with points value calculation
-- --------------------------------------------
DROP VIEW IF EXISTS pending_points CASCADE;

CREATE OR REPLACE VIEW pending_points AS
SELECT
  t.id,
  t.product_name,
  t.date as purchase_date,
  t.expected_platform_points,
  t.expected_card_points,
  NULL::date as points_expiry_date,
  (COALESCE(t.expected_platform_points, 0) + COALESCE(t.expected_card_points, 0)) as total_points,
  pm.name as payment_method_name,
  pm.point_rate as point_conversion_rate,
  -- Points value calculation
  (COALESCE(t.expected_platform_points, 0) * COALESCE(ppp.yen_conversion_rate, 1.0)) as platform_points_value,
  (COALESCE(t.expected_card_points, 0) * COALESCE(cpp.yen_conversion_rate, 1.0)) as card_points_value,
  (
    (COALESCE(t.expected_platform_points, 0) * COALESCE(ppp.yen_conversion_rate, 1.0)) +
    (COALESCE(t.expected_card_points, 0) * COALESCE(cpp.yen_conversion_rate, 1.0))
  ) as total_points_value,
  ppp.display_name as platform_points_platform_name,
  cpp.display_name as card_points_platform_name,
  'normal'::text as urgency_level
FROM transactions t
LEFT JOIN payment_methods pm ON t.card_id = pm.id
LEFT JOIN points_platforms ppp ON t.platform_points_platform_id = ppp.id
LEFT JOIN points_platforms cpp ON t.card_points_platform_id = cpp.id
WHERE t.user_id = auth.uid()
  AND t.point_status = 'pending'
ORDER BY t.date DESC;

COMMENT ON VIEW pending_points IS '待确认积分视图，包含积分价值计算（基于积分平台兑换率）';

-- ============================================
-- PART 3: ROI and Profit Calculation
-- ============================================

-- 3.1 Add total_profit field to transactions
-- --------------------------------------------
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS total_profit NUMERIC(10, 2);

COMMENT ON COLUMN transactions.total_profit IS '总利润（现金利润 + 积分价值）';
COMMENT ON COLUMN transactions.cash_profit IS '现金利润（不含积分价值）';

-- 3.2 Create automatic ROI recalculation trigger
-- --------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_transaction_profits()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate profit and ROI when status is 'sold'
  IF NEW.status = 'sold' THEN
    -- Recalculate cash profit
    NEW.cash_profit := COALESCE(NEW.selling_price, 0)
                      - NEW.purchase_price_total
                      - COALESCE(NEW.platform_fee, 0)
                      - COALESCE(NEW.shipping_fee, 0);

    -- Recalculate total profit (cash profit + all points value)
    NEW.total_profit := NEW.cash_profit +
      -- Platform points value
      COALESCE(NEW.expected_platform_points, 0) * COALESCE(
        (SELECT yen_conversion_rate FROM points_platforms WHERE id = NEW.platform_points_platform_id),
        1.0
      ) +
      -- Card points value
      COALESCE(NEW.expected_card_points, 0) * COALESCE(
        (SELECT yen_conversion_rate FROM points_platforms WHERE id = NEW.card_points_platform_id),
        1.0
      ) +
      -- Extra platform points value
      COALESCE(NEW.extra_platform_points, 0) * COALESCE(
        (SELECT yen_conversion_rate FROM points_platforms WHERE id = NEW.extra_platform_points_platform_id),
        1.0
      );

    -- Recalculate ROI
    IF (NEW.purchase_price_total - COALESCE(NEW.point_paid, 0)) > 0 THEN
      NEW.roi := (NEW.total_profit / (NEW.purchase_price_total - COALESCE(NEW.point_paid, 0))) * 100;
    ELSE
      NEW.roi := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.3 Create trigger
-- --------------------------------------------
DROP TRIGGER IF EXISTS trigger_recalculate_transaction_profits ON transactions;
CREATE TRIGGER trigger_recalculate_transaction_profits
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  WHEN (
    -- Only trigger when these fields change
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.selling_price IS DISTINCT FROM NEW.selling_price OR
    OLD.platform_fee IS DISTINCT FROM NEW.platform_fee OR
    OLD.shipping_fee IS DISTINCT FROM NEW.shipping_fee OR
    OLD.purchase_price_total IS DISTINCT FROM NEW.purchase_price_total OR
    OLD.point_paid IS DISTINCT FROM NEW.point_paid OR
    OLD.expected_platform_points IS DISTINCT FROM NEW.expected_platform_points OR
    OLD.expected_card_points IS DISTINCT FROM NEW.expected_card_points OR
    OLD.extra_platform_points IS DISTINCT FROM NEW.extra_platform_points OR
    OLD.platform_points_platform_id IS DISTINCT FROM NEW.platform_points_platform_id OR
    OLD.card_points_platform_id IS DISTINCT FROM NEW.card_points_platform_id OR
    OLD.extra_platform_points_platform_id IS DISTINCT FROM NEW.extra_platform_points_platform_id
  )
  EXECUTE FUNCTION recalculate_transaction_profits();

COMMENT ON FUNCTION recalculate_transaction_profits() IS '自动重新计算交易的现金利润、总利润和ROI';
COMMENT ON TRIGGER trigger_recalculate_transaction_profits ON transactions IS '当销售相关字段更新时自动重新计算利润和ROI';

-- ============================================
-- PART 4: Storage Bucket for Receipts
-- ============================================

-- 4.1 Create storage bucket with public access
-- --------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 4.2 Allow authenticated users to upload images
-- --------------------------------------------
CREATE POLICY "Users can upload receipt images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- 4.3 Allow public read access to receipt images
-- --------------------------------------------
DROP POLICY IF EXISTS "Users can view receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view receipt images" ON storage.objects;

CREATE POLICY "Public can view receipt images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- 4.4 Allow authenticated users to delete their own images
-- --------------------------------------------
CREATE POLICY "Users can delete receipt images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- 4.5 Allow authenticated users to update their own images
-- --------------------------------------------
CREATE POLICY "Users can update receipt images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================
-- PART 5: Batch Inventory Management
-- ============================================

-- 5.1 Add quantity fields to transactions table
-- --------------------------------------------
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 0 CHECK (quantity_sold >= 0),
ADD COLUMN IF NOT EXISTS quantity_in_stock INTEGER GENERATED ALWAYS AS (quantity - quantity_sold) STORED;

CREATE INDEX IF NOT EXISTS idx_transactions_quantity_in_stock ON transactions(quantity_in_stock);

COMMENT ON COLUMN transactions.quantity IS '商品总数量';
COMMENT ON COLUMN transactions.quantity_sold IS '已售出数量';
COMMENT ON COLUMN transactions.quantity_in_stock IS '库存数量（计算字段���';

-- 5.2 Create sales_records table
-- --------------------------------------------
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

  -- Calculated fields
  total_selling_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_sold * selling_price_per_unit) STORED,
  cash_profit DECIMAL(10, 2),
  total_profit DECIMAL(10, 2),
  roi DECIMAL(10, 2),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5.3 Add indexes for sales_records
-- --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_records_transaction_id ON sales_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_user_id ON sales_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_sale_date ON sales_records(sale_date);

-- 5.4 Enable RLS on sales_records
-- --------------------------------------------
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

-- 5.5 Create RLS policies for sales_records
-- --------------------------------------------
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

-- 5.6 Create trigger function to auto-update quantity_sold
-- --------------------------------------------
CREATE OR REPLACE FUNCTION update_transaction_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate transaction's quantity_sold
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

-- 5.7 Create triggers for quantity_sold synchronization
-- --------------------------------------------
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

-- 5.8 Create trigger function to auto-update transaction status
-- --------------------------------------------
CREATE OR REPLACE FUNCTION update_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
BEGIN
  -- Get transaction quantity information
  SELECT quantity, quantity_sold INTO trans_quantity, trans_quantity_sold
  FROM transactions
  WHERE id = NEW.transaction_id;

  -- If fully sold, update status to sold
  IF trans_quantity_sold >= trans_quantity THEN
    UPDATE transactions
    SET status = 'sold'
    WHERE id = NEW.transaction_id;
  -- If partially sold, keep in_stock status
  ELSIF trans_quantity_sold > 0 THEN
    UPDATE transactions
    SET status = 'in_stock'
    WHERE id = NEW.transaction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.9 Create trigger for status updates
-- --------------------------------------------
DROP TRIGGER IF EXISTS trigger_update_status_on_sale ON sales_records;
CREATE TRIGGER trigger_update_status_on_sale
  AFTER INSERT OR UPDATE OR DELETE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_status();

-- 5.10 Add comments
-- --------------------------------------------
COMMENT ON TABLE sales_records IS '销售记录表 - 记录批量商品的每次销售';
COMMENT ON COLUMN sales_records.quantity_sold IS '本次销售数量';
COMMENT ON COLUMN sales_records.selling_price_per_unit IS '单价';
COMMENT ON COLUMN sales_records.total_selling_price IS '总售价（计算字段）';

-- ============================================
-- Migration completed successfully!
-- ============================================
