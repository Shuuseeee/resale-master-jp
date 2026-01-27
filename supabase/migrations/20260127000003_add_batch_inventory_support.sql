-- 添加批量库存管理支持
-- 为 transactions 表添加数量字段，并创建 sales_records 表

-- 1. 为 transactions 表添加数量字段
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 0 CHECK (quantity_sold >= 0),
ADD COLUMN IF NOT EXISTS quantity_in_stock INTEGER GENERATED ALWAYS AS (quantity - quantity_sold) STORED;

-- 2. 为现有记录设置默认值
UPDATE transactions
SET quantity = 1, quantity_sold = CASE WHEN status = 'sold' THEN 1 ELSE 0 END
WHERE quantity IS NULL;

-- 3. 创建销售记录表
CREATE TABLE IF NOT EXISTS sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 销售信息
  quantity_sold INTEGER NOT NULL CHECK (quantity_sold > 0),
  selling_price_per_unit DECIMAL(10, 2) NOT NULL CHECK (selling_price_per_unit >= 0),
  platform_fee DECIMAL(10, 2) DEFAULT 0 CHECK (platform_fee >= 0),
  shipping_fee DECIMAL(10, 2) DEFAULT 0 CHECK (shipping_fee >= 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- 计算字段
  total_selling_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_sold * selling_price_per_unit) STORED,
  cash_profit DECIMAL(10, 2),
  total_profit DECIMAL(10, 2),
  roi DECIMAL(10, 2),

  -- 备注
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_sales_records_transaction_id ON sales_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_user_id ON sales_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_sale_date ON sales_records(sale_date);
CREATE INDEX IF NOT EXISTS idx_transactions_quantity_in_stock ON transactions(quantity_in_stock);

-- 5. 启用 RLS
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

-- 6. 创建 RLS 策略
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

-- 7. 创建触发器函数：自动更新 quantity_sold
CREATE OR REPLACE FUNCTION update_transaction_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  -- 重新计算 transaction 的 quantity_sold
  UPDATE transactions
  SET quantity_sold = (
    SELECT COALESCE(SUM(quantity_sold), 0)
    FROM sales_records
    WHERE transaction_id = NEW.transaction_id
  )
  WHERE id = NEW.transaction_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建触发器
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

-- 9. 创建触发器函数：自动更新 transaction status
CREATE OR REPLACE FUNCTION update_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
BEGIN
  -- 获取 transaction 的数量信息
  SELECT quantity, quantity_sold INTO trans_quantity, trans_quantity_sold
  FROM transactions
  WHERE id = NEW.transaction_id;

  -- 如果全部售出，更新状态为 sold
  IF trans_quantity_sold >= trans_quantity THEN
    UPDATE transactions
    SET status = 'sold'
    WHERE id = NEW.transaction_id;
  -- 如果部分售出，保持 in_stock 状态
  ELSIF trans_quantity_sold > 0 THEN
    UPDATE transactions
    SET status = 'in_stock'
    WHERE id = NEW.transaction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. 创建触发器
DROP TRIGGER IF EXISTS trigger_update_status_on_sale ON sales_records;
CREATE TRIGGER trigger_update_status_on_sale
  AFTER INSERT OR UPDATE OR DELETE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_status();

-- 11. 注释
COMMENT ON COLUMN transactions.quantity IS '商品总数量';
COMMENT ON COLUMN transactions.quantity_sold IS '已售出数量';
COMMENT ON COLUMN transactions.quantity_in_stock IS '库存数量（计算字段）';
COMMENT ON TABLE sales_records IS '销售记录表 - 记录批量商品的每次销售';
COMMENT ON COLUMN sales_records.quantity_sold IS '本次销售数量';
COMMENT ON COLUMN sales_records.selling_price_per_unit IS '单价';
COMMENT ON COLUMN sales_records.total_selling_price IS '总售价（计算字段）';
