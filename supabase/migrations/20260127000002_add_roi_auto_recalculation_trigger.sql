-- 添加自动重新计算 ROI 的触发器
-- 当销售相关字段更新时，自动重新计算 cash_profit, total_profit 和 roi

-- 创建触发器函数
CREATE OR REPLACE FUNCTION recalculate_transaction_profits()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在状态为 'sold' 时计算利润和 ROI
  IF NEW.status = 'sold' THEN
    -- 重新计算现金利润
    NEW.cash_profit := COALESCE(NEW.selling_price, 0)
                      - NEW.purchase_price_total
                      - COALESCE(NEW.platform_fee, 0)
                      - COALESCE(NEW.shipping_fee, 0);

    -- 重新计算总利润（现金利润 + 所有积分价值）
    NEW.total_profit := NEW.cash_profit +
      -- 平台积分价值
      COALESCE(NEW.expected_platform_points, 0) * COALESCE(
        (SELECT yen_conversion_rate FROM points_platforms WHERE id = NEW.platform_points_platform_id),
        1.0
      ) +
      -- 信用卡积分价值
      COALESCE(NEW.expected_card_points, 0) * COALESCE(
        (SELECT yen_conversion_rate FROM points_platforms WHERE id = NEW.card_points_platform_id),
        1.0
      ) +
      -- 额外平台积分价值
      COALESCE(NEW.extra_platform_points, 0) * COALESCE(
        (SELECT yen_conversion_rate FROM points_platforms WHERE id = NEW.extra_platform_points_platform_id),
        1.0
      );

    -- 重新计算 ROI
    IF (NEW.purchase_price_total - COALESCE(NEW.point_paid, 0)) > 0 THEN
      NEW.roi := (NEW.total_profit / (NEW.purchase_price_total - COALESCE(NEW.point_paid, 0))) * 100;
    ELSE
      NEW.roi := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（在 UPDATE 之前触发）
DROP TRIGGER IF EXISTS trigger_recalculate_transaction_profits ON transactions;
CREATE TRIGGER trigger_recalculate_transaction_profits
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  WHEN (
    -- 只在以下字段发生变化时触发
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.selling_price IS DISTINCT FROM NEW.selling_price OR
    OLD.platform_fee IS DISTINCT FROM NEW.platform_fee OR
    OLD.shipping_fee IS DISTINCT FROM NEW.shipping_fee OR
    OLD.purchase_price_total IS DISTINCT FROM NEW.purchase_price_total OR
    OLD.point_paid IS DISTINCT FROM NEW.point_paid OR
    OLD.expected_platform_points IS DISTINCT FROM NEW.expected_platform_points OR
    OLD.expected_card_points IS DISTINCT FROM NEW.expected_card_points OR
    OLD.extra_platform_points IS DISTINCT FROM NEW.extra_platform_points OR
    OLD.platform_points_platform_id IS DISTINCT FROM NEW.platform_points_platform_id OR
    OLD.card_points_platform_id IS DISTINCT FROM NEW.card_points_platform_id OR
    OLD.extra_platform_points_platform_id IS DISTINCT FROM NEW.extra_platform_points_platform_id
  )
  EXECUTE FUNCTION recalculate_transaction_profits();

-- 注释
COMMENT ON FUNCTION recalculate_transaction_profits() IS '自动重新计算交易的现金利润、总利润和ROI';
COMMENT ON TRIGGER trigger_recalculate_transaction_profits ON transactions IS '当销售相关字段更新时自动重新计算利润和ROI';
