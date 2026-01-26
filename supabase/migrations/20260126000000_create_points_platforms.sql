-- 创建积分平台表
-- 用于管理不同的积分平台及其兑换率

CREATE TABLE IF NOT EXISTS points_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 平台名称，如 "PayPay", "V Point", "楽天ポイント"
  display_name TEXT NOT NULL, -- 显示名称
  yen_conversion_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0, -- 积分兑换日元的比率（1积分=X日元）
  description TEXT, -- 平台描述
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入常见的积分平台
INSERT INTO points_platforms (name, display_name, yen_conversion_rate, description) VALUES
  ('paypay', 'PayPay ポイント', 1.0, 'PayPay积分，1积分=1日元'),
  ('vpoint', 'V ポイント', 1.0, '三井住友V Point，1积分=1日元'),
  ('rakuten', '楽天ポイント', 1.0, '楽天积分，1积分=1日元'),
  ('dpoint', 'd ポイント', 1.0, 'dポイント，1积分=1日元'),
  ('tpoint', 'T ポイント', 1.0, 'Tポイント，1积分=1日元'),
  ('ponta', 'Ponta ポイント', 1.0, 'Pontaポイント，1积分=1日元'),
  ('generic_card_3to1', '信用卡积分 (3:1)', 0.3333, '通用信用卡积分，3积分=1日元'),
  ('generic_card_1to1', '信用卡积分 (1:1)', 1.0, '通用信用卡积分，1积分=1日元');

-- 添加RLS策略
ALTER TABLE points_platforms ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可以读取积分平台信息
CREATE POLICY "Anyone can view points platforms"
  ON points_platforms
  FOR SELECT
  TO authenticated
  USING (true);

-- 创建更新时间触发器
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

-- 添加索引
CREATE INDEX idx_points_platforms_name ON points_platforms(name);
CREATE INDEX idx_points_platforms_active ON points_platforms(is_active);
