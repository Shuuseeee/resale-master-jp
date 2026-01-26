-- 修改交易表，添加积分平台关联
-- 支持更灵活的积分类型管理

-- 1. 添加积分平台ID字段
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS platform_points_platform_id UUID REFERENCES points_platforms(id),
ADD COLUMN IF NOT EXISTS card_points_platform_id UUID REFERENCES points_platforms(id);

-- 2. 为现有交易数据设置积分平台
-- 2.1 设置购物平台积分平台（根据expected_platform_points判断）
UPDATE transactions t
SET platform_points_platform_id = (
  SELECT pp.id FROM points_platforms pp
  WHERE pp.name = 'rakuten' -- 默认假设是楽天，可以根据实际情况调整
  LIMIT 1
)
WHERE t.expected_platform_points > 0
  AND t.platform_points_platform_id IS NULL;

-- 2.2 设置信用卡积分平台（从payment_methods获取）
UPDATE transactions t
SET card_points_platform_id = pm.card_points_platform_id
FROM payment_methods pm
WHERE t.card_id = pm.id
  AND t.expected_card_points > 0
  AND t.card_points_platform_id IS NULL;

-- 3. 添加注释
COMMENT ON COLUMN transactions.platform_points_platform_id IS '购物平台积分的平台ID（如楽天、PayPay Mall等）';
COMMENT ON COLUMN transactions.card_points_platform_id IS '信用卡/支付方式积分的平台ID';
COMMENT ON COLUMN transactions.expected_platform_points IS '预期获得的平台积分数量';
COMMENT ON COLUMN transactions.expected_card_points IS '预期获得的信用卡/支付方式积分数量';

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_transactions_platform_points_platform
ON transactions(platform_points_platform_id);

CREATE INDEX IF NOT EXISTS idx_transactions_card_points_platform
ON transactions(card_points_platform_id);
