-- Fix ROI and total_profit calculation for all sold transactions
-- This migration ensures all sold transactions have correct total_profit and ROI values

-- Update all sold transactions with correct calculations
UPDATE transactions
SET
  -- Calculate total_profit: cash_profit + all points values
  total_profit = (
    COALESCE(cash_profit, 0) +
    -- Platform points value
    COALESCE(expected_platform_points, 0) * COALESCE(
      (SELECT yen_conversion_rate FROM points_platforms WHERE id = transactions.platform_points_platform_id),
      1.0
    ) +
    -- Card points value
    COALESCE(expected_card_points, 0) * COALESCE(
      (SELECT yen_conversion_rate FROM points_platforms WHERE id = transactions.card_points_platform_id),
      1.0
    ) +
    -- Extra platform points value
    COALESCE(extra_platform_points, 0) * COALESCE(
      (SELECT yen_conversion_rate FROM points_platforms WHERE id = transactions.extra_platform_points_platform_id),
      1.0
    )
  ),
  -- Calculate ROI: total_profit / actual_cash_spent * 100
  roi = CASE
    WHEN (purchase_price_total - COALESCE(point_paid, 0)) > 0 THEN
      (
        -- Total profit calculation (same as above)
        (
          COALESCE(cash_profit, 0) +
          COALESCE(expected_platform_points, 0) * COALESCE(
            (SELECT yen_conversion_rate FROM points_platforms WHERE id = transactions.platform_points_platform_id),
            1.0
          ) +
          COALESCE(expected_card_points, 0) * COALESCE(
            (SELECT yen_conversion_rate FROM points_platforms WHERE id = transactions.card_points_platform_id),
            1.0
          ) +
          COALESCE(extra_platform_points, 0) * COALESCE(
            (SELECT yen_conversion_rate FROM points_platforms WHERE id = transactions.extra_platform_points_platform_id),
            1.0
          )
        ) /
        -- Actual cash spent (purchase_price_total - point_paid)
        (purchase_price_total - COALESCE(point_paid, 0))
      ) * 100
    ELSE 0
  END
WHERE
  status = 'sold';

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
  sample_transaction RECORD;
BEGIN
  -- Count updated transactions
  SELECT COUNT(*) INTO updated_count
  FROM transactions
  WHERE status = 'sold';

  RAISE NOTICE 'Updated % sold transactions', updated_count;

  -- Show a sample transaction for verification
  SELECT
    id,
    product_name,
    purchase_price_total,
    point_paid,
    cash_profit,
    total_profit,
    roi
  INTO sample_transaction
  FROM transactions
  WHERE status = 'sold'
  LIMIT 1;

  IF FOUND THEN
    RAISE NOTICE 'Sample transaction: % - total_profit: %, roi: %',
      sample_transaction.product_name,
      sample_transaction.total_profit,
      sample_transaction.roi;
  END IF;
END $$;
