-- Add total_profit field to transactions table
-- total_profit = cash_profit + points_value (in yen)

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS total_profit NUMERIC(10, 2);

COMMENT ON COLUMN transactions.total_profit IS '总利润（现金利润 + 积分价值）';
COMMENT ON COLUMN transactions.cash_profit IS '现金利润（不含积分价值）';
