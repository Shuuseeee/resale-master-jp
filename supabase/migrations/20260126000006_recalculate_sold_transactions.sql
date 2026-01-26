-- Recalculate total_profit and ROI for all sold transactions
-- This migration fixes existing data to use the new calculation formulas

-- Update all sold transactions with correct total_profit and ROI
UPDATE transactions
SET
  total_profit = (
    -- cash_profit (already stored correctly)
    COALESCE(cash_profit, 0) +
    -- platform points value
    COALESCE(expected_platform_points, 0) * COALESCE(
      (SELECT yen_conversion_rate FROM points_platforms WHERE id = platform_points_platform_id),
      1.0
    ) +
    -- card points value
    COALESCE(expected_card_points, 0) * COALESCE(
      (SELECT yen_conversion_rate FROM points_platforms WHERE id = card_points_platform_id),
      1.0
    ) +
    -- extra platform points value
    COALESCE(extra_platform_points, 0) * COALESCE(
      (SELECT yen_conversion_rate FROM points_platforms WHERE id = extra_platform_points_platform_id),
      1.0
    )
  ),
  roi = CASE
    WHEN (purchase_price_total - COALESCE(point_paid, 0)) > 0 THEN
      (
        -- total_profit calculation
        (
          COALESCE(cash_profit, 0) +
          COALESCE(expected_platform_points, 0) * COALESCE(
            (SELECT yen_conversion_rate FROM points_platforms WHERE id = platform_points_platform_id),
            1.0
          ) +
          COALESCE(expected_card_points, 0) * COALESCE(
            (SELECT yen_conversion_rate FROM points_platforms WHERE id = card_points_platform_id),
            1.0
          ) +
          COALESCE(extra_platform_points, 0) * COALESCE(
            (SELECT yen_conversion_rate FROM points_platforms WHERE id = extra_platform_points_platform_id),
            1.0
          )
        ) /
        -- actual cash spent (purchase_price_total - point_paid)
        (purchase_price_total - COALESCE(point_paid, 0))
      ) * 100
    ELSE 0
  END
WHERE
  status = 'sold';

-- Log the number of updated transactions
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM transactions
  WHERE status = 'sold';

  RAISE NOTICE 'Updated % sold transactions with new profit calculations', updated_count;
END $$;
