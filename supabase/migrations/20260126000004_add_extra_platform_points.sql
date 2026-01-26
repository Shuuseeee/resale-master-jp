-- 添加额外平台积分支持
-- 用于记录叠加积分场景（如Amazon积分 + d point）

-- 1. 添加Amazon积分平台
INSERT INTO points_platforms (name, display_name, yen_conversion_rate, description)
VALUES ('amazon', 'Amazon ポイント', 1.0, 'Amazonポイント，1积分=1日元')
ON CONFLICT (name) DO NOTHING;

-- 2. 为transactions表添加额外平台积分字段
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS extra_platform_points NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_platform_points_platform_id UUID REFERENCES points_platforms(id);

-- 3. 添加注释
COMMENT ON COLUMN transactions.extra_platform_points IS '额外平台积分数量（用于叠加积分场景，如d point）';
COMMENT ON COLUMN transactions.extra_platform_points_platform_id IS '额外平台积分的平台ID';

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_transactions_extra_platform_points_platform
ON transactions(extra_platform_points_platform_id);
