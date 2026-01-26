-- 修改支付方式表，添加积分平台关联
-- 将原有的point_rate字段迁移到points_platform关联

-- 1. 添加新字段
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS card_points_platform_id UUID REFERENCES points_platforms(id);

-- 2. 为现有数据设置默认积分平台
-- 根据point_rate判断应该使用哪个积分平台
UPDATE payment_methods
SET card_points_platform_id = (
  SELECT id FROM points_platforms
  WHERE name = CASE
    WHEN payment_methods.point_rate >= 0.9 THEN 'generic_card_1to1'
    WHEN payment_methods.point_rate >= 0.3 THEN 'generic_card_3to1'
    ELSE 'generic_card_3to1'
  END
  LIMIT 1
)
WHERE card_points_platform_id IS NULL
  AND type = 'card';

-- 3. 为钱包类型设置PayPay平台（假设钱包主要是PayPay）
UPDATE payment_methods
SET card_points_platform_id = (
  SELECT id FROM points_platforms WHERE name = 'paypay' LIMIT 1
)
WHERE card_points_platform_id IS NULL
  AND type = 'wallet';

-- 4. 添加注释
COMMENT ON COLUMN payment_methods.card_points_platform_id IS '信用卡/支付方式关联的积分平台ID';
COMMENT ON COLUMN payment_methods.point_rate IS '(已废弃) 积分返点率，请使用card_points_platform_id关联积分平台';

-- 5. 添加索引
CREATE INDEX IF NOT EXISTS idx_payment_methods_card_points_platform
ON payment_methods(card_points_platform_id);
