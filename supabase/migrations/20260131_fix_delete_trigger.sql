-- 修复 DELETE 触发器的 bug
-- 在 DELETE 操作时应该使用 OLD 而不是 NEW

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
