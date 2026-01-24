-- 更新现有交易记录的还款日期
-- 此脚本会根据最新的 payment_same_month 配置重新计算所有交易的还款日期

-- 创建一个函数来计算还款日期
CREATE OR REPLACE FUNCTION calculate_payment_date(
  transaction_date DATE,
  closing_day INTEGER,
  payment_day INTEGER,
  payment_same_month BOOLEAN
) RETURNS DATE AS $$
DECLARE
  closing_date DATE;
  payment_month INTEGER;
  payment_year INTEGER;
BEGIN
  -- 计算本月账单日
  closing_date := DATE_TRUNC('month', transaction_date) + (closing_day - 1) * INTERVAL '1 day';

  -- 如果交易日期在账单日之后，使用下个月的账单日
  IF EXTRACT(DAY FROM transaction_date) > closing_day THEN
    closing_date := closing_date + INTERVAL '1 month';
  END IF;

  -- 根据配置决定还款月份
  IF payment_same_month THEN
    -- 当月还款：使用账单日所在月份
    payment_month := EXTRACT(MONTH FROM closing_date);
    payment_year := EXTRACT(YEAR FROM closing_date);
  ELSE
    -- 次月还款：账单日的下个月
    closing_date := closing_date + INTERVAL '1 month';
    payment_month := EXTRACT(MONTH FROM closing_date);
    payment_year := EXTRACT(YEAR FROM closing_date);
  END IF;

  -- 构造还款日期
  RETURN make_date(payment_year, payment_month, payment_day);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 更新所有交易的还款日期
UPDATE transactions t
SET expected_payment_date = calculate_payment_date(
  t.date::DATE,
  pm.closing_day,
  pm.payment_day,
  COALESCE(pm.payment_same_month, false)
)
FROM payment_methods pm
WHERE t.card_id = pm.id
  AND pm.closing_day IS NOT NULL
  AND pm.payment_day IS NOT NULL;

-- 查看更新结果
SELECT
  t.id,
  t.product_name,
  t.date AS transaction_date,
  pm.name AS card_name,
  pm.closing_day,
  pm.payment_day,
  pm.payment_same_month,
  t.expected_payment_date
FROM transactions t
LEFT JOIN payment_methods pm ON t.card_id = pm.id
WHERE t.card_id IS NOT NULL
ORDER BY t.date DESC
LIMIT 10;

-- 注释：执行此脚本后，可以删除辅助函数（如果不需要保留）
-- DROP FUNCTION IF EXISTS calculate_payment_date(DATE, INTEGER, INTEGER, BOOLEAN);
