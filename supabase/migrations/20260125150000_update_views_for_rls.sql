-- Update views to filter by user_id and use SECURITY INVOKER
-- This ensures views respect RLS policies

-- Drop existing views
DROP VIEW IF EXISTS financial_water_level;
DROP VIEW IF EXISTS upcoming_payments;
DROP VIEW IF EXISTS pending_points;

-- Recreate financial_water_level view with user_id filtering
CREATE VIEW financial_water_level
WITH (security_invoker = true) AS
SELECT
  auth.uid() as user_id,
  COALESCE(SUM(ba.current_balance), 0) as total_balance,
  (
    SELECT COALESCE(SUM(t.card_paid), 0)
    FROM transactions t
    WHERE t.user_id = auth.uid()
      AND t.expected_payment_date <= CURRENT_DATE + INTERVAL '30 days'
  ) as upcoming_payments_30d,
  (
    SELECT COALESCE(SUM(t.card_paid), 0)
    FROM transactions t
    WHERE t.user_id = auth.uid()
      AND t.expected_payment_date <= CURRENT_DATE + INTERVAL '7 days'
  ) as upcoming_payments_7d,
  (
    SELECT COUNT(*)
    FROM coupons c
    WHERE c.user_id = auth.uid()
      AND c.is_used = false
      AND c.expiry_date <= CURRENT_DATE + INTERVAL '3 days'
      AND c.expiry_date >= CURRENT_DATE
  ) as expiring_coupons_3d,
  0 as expiring_points_7d
FROM bank_accounts ba
WHERE ba.user_id = auth.uid()
  AND ba.is_active = true;

-- Recreate upcoming_payments view with user_id filtering
CREATE VIEW upcoming_payments
WITH (security_invoker = true) AS
SELECT
  pm.name as payment_method_name,
  t.expected_payment_date,
  SUM(t.card_paid) as total_amount,
  COUNT(*) as transaction_count,
  t.card_id as payment_method_id
FROM transactions t
LEFT JOIN payment_methods pm ON t.card_id = pm.id
WHERE t.user_id = auth.uid()
  AND t.expected_payment_date IS NOT NULL
GROUP BY pm.name, t.expected_payment_date, t.card_id
ORDER BY t.expected_payment_date;

-- Recreate pending_points view with user_id filtering
CREATE VIEW pending_points
WITH (security_invoker = true) AS
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
  'normal'::text as urgency_level
FROM transactions t
LEFT JOIN payment_methods pm ON t.card_id = pm.id
WHERE t.user_id = auth.uid()
  AND t.point_status = 'pending'
ORDER BY t.date DESC;
