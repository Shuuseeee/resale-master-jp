-- ============================================
-- 修复退货状态问题
-- 执行日期：2026-01-31
-- 问题：transactions_status_check 约束可能不允许 'returned' 状态
-- ============================================

-- 1. 如果有旧的 CHECK 约束，先删除它
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'transactions_status_check'
      AND table_name = 'transactions'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT transactions_status_check;
  END IF;
END $$;

-- 2. 确保 status 列存在并使用正确的类型
-- 如果使用的是 ENUM 类型
DO $$
BEGIN
  -- 检查是否存在 transaction_status 枚举类型
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    -- 确保 'returned' 值存在于枚举中
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'transaction_status'::regtype
        AND enumlabel = 'returned'
    ) THEN
      ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'returned';
    END IF;
  ELSE
    -- 如果不是枚举类型，添加 CHECK 约束
    ALTER TABLE transactions
    ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('in_stock', 'sold', 'returned'));
  END IF;
END $$;

-- 3. 修复 update_transaction_status 触发器函数
-- 这个函数应该保留手动设置的 'returned' 状态
CREATE OR REPLACE FUNCTION update_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  target_transaction_id UUID;
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
  current_status TEXT;
BEGIN
  -- 根据操作类型选择正确的 transaction_id
  IF TG_OP = 'DELETE' THEN
    target_transaction_id := OLD.transaction_id;
  ELSE
    target_transaction_id := NEW.transaction_id;
  END IF;

  -- 获取 transaction 的数量信息和当前状态
  SELECT quantity, quantity_sold, status
  INTO trans_quantity, trans_quantity_sold, current_status
  FROM transactions
  WHERE id = target_transaction_id;

  -- 如果状态是 'returned'，不要自动更改它
  IF current_status = 'returned' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

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

COMMENT ON FUNCTION update_transaction_status() IS '自动更新 transaction 的 status，支持 INSERT/UPDATE/DELETE。保留手动设置的 returned 状态';

-- ============================================
-- 验证迁移结果
-- ============================================

-- 显示允许的状态值
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    RAISE NOTICE '允许的状态值（ENUM）：';
    PERFORM enumlabel FROM pg_enum
    WHERE enumtypid = 'transaction_status'::regtype
    ORDER BY enumsortorder;
  ELSE
    RAISE NOTICE '状态字段使用 TEXT 类型，通过 CHECK 约束限制';
  END IF;
END $$;
