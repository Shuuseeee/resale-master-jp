-- Diagnose ROI calculation issue
-- Show detailed breakdown for sold transactions

SELECT
  product_name,
  purchase_price_total,
  point_paid,
  (purchase_price_total - COALESCE(point_paid, 0)) as actual_cash_spent,
  selling_price,
  platform_fee,
  shipping_fee,
  cash_profit,
  expected_platform_points,
  expected_card_points,
  extra_platform_points,
  total_profit,
  roi,
  -- Recalculate what ROI should be
  CASE
    WHEN (purchase_price_total - COALESCE(point_paid, 0)) > 0 THEN
      (total_profit / (purchase_price_total - COALESCE(point_paid, 0))) * 100
    ELSE 0
  END as calculated_roi
FROM transactions
WHERE status = 'sold'
ORDER BY date DESC
LIMIT 5;
