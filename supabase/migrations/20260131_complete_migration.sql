-- ============================================
-- 完整迁移脚本：修复销售日期功能
-- 执行日期：2026-01-31
-- ============================================

-- ============================================
-- 迁移 1: 添加 sale_date 字段
-- ============================================

ALTER TABLE sales_records
ADD COLUMN IF NOT EXISTS sale_date DATE;

COMMENT ON COLUMN sales_records.sale_date IS '販売日 - 実際に商品が販売された日付。税務申告と収益分析に使用';

-- ============================================
-- 迁移 2: 修复 DELETE 触发器
-- ============================================

-- 1. 修复 update_transaction_quantity_sold 函数
CREATE OR REPLACE FUNCTION update_transaction_quantity_sold()
RETURNS TRIGGER AS $$
DECLARE
  target_transaction_id UUID;
BEGIN
  -- 根据操作类型选择正确的 transaction_id
  IF TG_OP = 'DELETE' THEN
    target_transaction_id := OLD.transaction_id;
  ELSE
    target_transaction_id := NEW.transaction_id;
  END IF;

  -- 重新计算 transaction 的 quantity_sold
  UPDATE transactions
  SET quantity_sold = (
    SELECT COALESCE(SUM(quantity_sold), 0)
    FROM sales_records
    WHERE transaction_id = target_transaction_id
  )
  WHERE id = target_transaction_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. 修复 update_transaction_status 函数
CREATE OR REPLACE FUNCTION update_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  target_transaction_id UUID;
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
BEGIN
  -- 根据操作类型选择正确的 transaction_id
  IF TG_OP = 'DELETE' THEN
    target_transaction_id := OLD.transaction_id;
  ELSE
    target_transaction_id := NEW.transaction_id;
  END IF;

  -- 获取 transaction 的数量信息
  SELECT quantity, quantity_sold INTO trans_quantity, trans_quantity_sold
  FROM transactions
  WHERE id = target_transaction_id;

  -- 如果全部售出，更新状态为 sold
  IF trans_quantity_sold >= trans_quantity THEN
    UPDATE transactions
    SET status = 'sold'
    WHERE id = target_transaction_id;
  -- 如果部分售出或全部取消，保持 in_stock 状态
  ELSIF trans_quantity_sold > 0 THEN
    UPDATE transactions
    SET status = 'in_stock'
    WHERE id = target_transaction_id;
  -- 如果全部取消（quantity_sold = 0），状态改为 in_stock
  ELSE
    UPDATE transactions
    SET status = 'in_stock'
    WHERE id = target_transaction_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 注释
COMMENT ON FUNCTION update_transaction_quantity_sold() IS '自动更新 transaction 的 quantity_sold，支持 INSERT/UPDATE/DELETE';
COMMENT ON FUNCTION update_transaction_status() IS '自动更新 transaction 的 status，支持 INSERT/UPDATE/DELETE';

-- ============================================
-- 迁移 3: 为旧的单件商品创建 sales_records
-- ============================================

-- 为旧的单件商品创建 sales_records
-- 这些商品有 selling_price 但没有 sales_records
-- 注意：
-- 1. total_selling_price 是生成列，会自动计算
-- 2. sale_date 使用 transaction.date（购买日期）作为临时值
-- 3. 用户需要手动修改为实际销售日期

INSERT INTO sales_records (
  transaction_id,
  user_id,
  quantity_sold,
  selling_price_per_unit,
  platform_fee,
  shipping_fee,
  sale_date,
  cash_profit,
  total_profit,
  roi,
  notes
)
SELECT
  t.id as transaction_id,
  t.user_id,
  1 as quantity_sold,  -- 单件商品
  t.selling_price as selling_price_per_unit,
  COALESCE(t.platform_fee, 0) as platform_fee,
  COALESCE(t.shipping_fee, 0) as shipping_fee,
  t.date as sale_date,  -- 使用购买日期作为临时销售日期
  t.cash_profit,
  t.total_profit,
  t.roi,
  '⚠️ 从旧数据迁移，销售日期暂用购买日期，请修改为实际销售日期' as notes
FROM transactions t
WHERE t.status = 'sold'
  AND t.quantity = 1
  AND t.selling_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sales_records sr
    WHERE sr.transaction_id = t.id
  );

-- ============================================
-- 迁移完成
-- ============================================

-- 显示迁移结果
SELECT
  '迁移完成！' as status,
  COUNT(*) as migrated_records
FROM sales_records
WHERE notes LIKE '%从旧数据迁移%';
