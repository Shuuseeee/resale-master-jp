-- 更新pending_points视图，包含积分价值计算

DROP VIEW IF EXISTS pending_points CASCADE;

CREATE OR REPLACE VIEW pending_points AS
SELECT
  t.id,
  t.product_name,
  t.date as purchase_date,
  t.expected_platform_points,
  t.expected_card_points,
  NULL::date as points_expiry_date,
  (COALESCE(t.expected_platform_points, 0) + COALESCE(t.expected_card_points, 0)) as total_points,
  pm.name as payment_method_name,
  pm.point_rate as point_conversion_rate,
  -- 新增：积分价值计算
  (COALESCE(t.expected_platform_points, 0) * COALESCE(ppp.yen_conversion_rate, 1.0)) as platform_points_value,
  (COALESCE(t.expected_card_points, 0) * COALESCE(cpp.yen_conversion_rate, 1.0)) as card_points_value,
  (
    (COALESCE(t.expected_platform_points, 0) * COALESCE(ppp.yen_conversion_rate, 1.0)) +
    (COALESCE(t.expected_card_points, 0) * COALESCE(cpp.yen_conversion_rate, 1.0))
  ) as total_points_value,
  ppp.display_name as platform_points_platform_name,
  cpp.display_name as card_points_platform_name,
  'normal'::text as urgency_level
FROM transactions t
LEFT JOIN payment_methods pm ON t.card_id = pm.id
LEFT JOIN points_platforms ppp ON t.platform_points_platform_id = ppp.id
LEFT JOIN points_platforms cpp ON t.card_points_platform_id = cpp.id
WHERE t.user_id = auth.uid()
  AND t.point_status = 'pending'
ORDER BY t.date DESC;

-- 添加注释
COMMENT ON VIEW pending_points IS '待确认积分视图，包含积分价值计算（基于积分平台兑换率）';
