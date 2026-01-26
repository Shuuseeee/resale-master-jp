-- Fix ROI calculation from scratch - recalculate cash_profit, total_profit, and ROI
-- This migration recalculates all values from raw data to ensure correctness

UPDATE transactions
SET
  -- Recalculate cash_profit from raw values
  cash_profit = COALESCE(selling_price, 0) - purchase_price_total - COALESCE(platform_fee, 0) - COALESCE(shipping_fee, 0),

  -- Calculate total_profit: cash_profit + all points values
  total_profit = (
    -- Cash profit (recalculated)
    COALESCE(selling_price, 0) - purchase_price_total - COALESCE(platform_fee, 0) - COALESCE(shipping_fee, 0) +
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
        -- Total profit (recalculated from scratch)
        (
          COALESCE(selling_price, 0) - purchase_price_total - COALESCE(platform_fee, 0) - COALESCE(shipping_fee, 0) +
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
        -- Actual cash spent
        (purchase_price_total - COALESCE(point_paid, 0))
      ) * 100
    ELSE 0
  END
WHERE
  status = 'sold';
