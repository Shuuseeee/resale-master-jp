-- 32_buyback_price_stale_yesterday.sql（2026-11-01）
-- 买取报价的作废规则从「超过 7 天」改成「日本时间昨天 0 点之前更新的作废」（今天、昨天的有效）。
-- 只改视图 assistant_buyback_prices 的 is_stale；assistant_purchases / assistant_overview 读它，自动跟着变。
-- 列不变，CREATE OR REPLACE 即可。可重复执行。
CREATE OR REPLACE VIEW public.assistant_buyback_prices WITH (security_invoker = true) AS
WITH entries AS (
  SELECT c.jan, e->>'store' AS store, (e->>'price')::numeric AS price,
    COALESCE((e->>'updated_at')::timestamptz, c.fetched_at - public.kaitorix_relative_age(e->>'updated')) AS price_updated_at,
    'api'::text AS source, c.fetched_at AS fetched_at
  FROM public.kaitorix_price_cache c, jsonb_array_elements(COALESCE(c.prices, '[]'::jsonb)) e
  UNION ALL
  SELECT k.jan, e->>'store', (e->>'price')::numeric, (e->>'updated_at')::timestamptz, 'csv', k.synced_at
  FROM public.kaitorix_catalog k, jsonb_array_elements(k.prices) e
)
SELECT DISTINCT ON (jan, store)
  jan, store, price, price_updated_at, source, fetched_at,
  (price_updated_at IS NOT NULL AND price_updated_at < (((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)::timestamp AT TIME ZONE 'Asia/Tokyo')) AS is_stale
FROM entries
WHERE price > 0
ORDER BY jan, store, COALESCE(price_updated_at, fetched_at) DESC;

COMMENT ON VIEW public.assistant_buyback_prices IS '每个 JAN × 买取店的最新报价（官方 API 缓存与每日 CSV 取较新）。is_stale = 该店报价在日本时间昨天 0 点之前更新，不作参考。';
COMMENT ON VIEW public.assistant_purchases IS '按进货汇总（与买取X 进货列表同口径）。unit_cost = (采购总价 − 三种积分) ÷ 数量；confirmed_profit = 各次出售利润 − 退货损失；quantity_unsold = 库存 + 未到货；best_price 只取日本时间昨天 0 点以后更新的报价；estimated_profit = (best_price − unit_cost) × quantity_unsold。';
COMMENT ON VIEW public.assistant_overview IS '每个用户的整体汇总：confirmed_profit = 销售利润 − 退货损失 − 经费；profit_rate = confirmed_profit ÷ 售出部分成本；inventory_cost = 未售数量 × 单位成本；unpriced_qty = 没有有效（昨天 0 点以后）买取价的未售数量。';
