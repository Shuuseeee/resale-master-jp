-- 19_assistant_views.sql（2026-10-10）
-- 贩卖助手只读视图：assistant_buyback_prices / assistant_purchases / assistant_overview（+ 相对时间解析函数）
-- 只新建函数与视图，不改任何数据；可重复执行。依赖 18_profit_unify.sql（return_records.loss_amount 与利润触发器）。

-- ============================================================
-- 贩卖助手只读视图（2026-10-10）：给 Claude 对话（Supabase MCP）和以后的页面查询用，口径固定在库里
-- 利润口径见 calc_sale_profit / calc_transaction_profit（与买取X 一致）；买取价按「单店报价超过 7 天不参考」规则
-- 都是 security_invoker：登录用户只看到自己的行；用服务端权限查询（如 MCP）会看到所有用户，需按 user_id 过滤
-- 注意：网页「设置 > 买取价格检查」里的店铺筛选存在浏览器本地，视图无法读取，这里包含全部店铺
-- ============================================================

-- "8分前" / "3時間前" / "2日前" → 时长（买取价旧缓存里的相对时间；无法解析返回 NULL）
CREATE OR REPLACE FUNCTION public.kaitorix_relative_age(p_text text)
 RETURNS interval
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE m[2]
    WHEN '分' THEN m[1]::int * interval '1 minute'
    WHEN '時間' THEN m[1]::int * interval '1 hour'
    WHEN '日' THEN m[1]::int * interval '1 day'
    WHEN '週間' THEN m[1]::int * interval '7 days'
    ELSE m[1]::int * interval '30 days'
  END
  FROM (SELECT regexp_match(p_text, '(\d+)\s*(分|時間|日|週間|ヶ月|か月|カ月)\s*前') AS m) x
  WHERE m IS NOT NULL;
$function$;

-- 每个 JAN × 店铺的最新买取报价：官方 API 缓存（打开网页时刷新）与每日 CSV 目录取较新的一条
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
  (price_updated_at IS NOT NULL AND price_updated_at < now() - interval '7 days') AS is_stale
FROM entries
WHERE price > 0
ORDER BY jan, store, COALESCE(price_updated_at, fetched_at) DESC;

-- 按进货汇总（对应买取X 的进货列表）：成本、已售、确定利润、库存、当前最高买取价、预估利润
CREATE OR REPLACE VIEW public.assistant_purchases WITH (security_invoker = true) AS
WITH s AS (
  SELECT transaction_id, sum(total_selling_price) AS revenue,
    sum(COALESCE(platform_fee, 0) + COALESCE(shipping_fee, 0)) AS deductions, max(sale_date) AS last_sale_date
  FROM public.sales_records GROUP BY transaction_id
), r AS (
  SELECT transaction_id, sum(loss_amount) AS return_loss FROM public.return_records GROUP BY transaction_id
), best AS (
  SELECT jan, max(price) AS best_price FROM public.assistant_buyback_prices WHERE NOT is_stale GROUP BY jan
), best_store AS (
  SELECT p.jan, string_agg(p.store, '、' ORDER BY p.store) AS best_stores, max(p.price_updated_at) AS best_price_updated_at
  FROM public.assistant_buyback_prices p JOIN best b ON b.jan = p.jan AND p.price = b.best_price
  WHERE NOT p.is_stale GROUP BY p.jan
), base AS (
  SELECT t.*,
    COALESCE(t.expected_platform_points, 0) + COALESCE(t.expected_card_points, 0) + COALESCE(t.extra_platform_points, 0) AS points_total,
    (t.purchase_price_total - COALESCE(t.expected_platform_points, 0) - COALESCE(t.expected_card_points, 0)
      - COALESCE(t.extra_platform_points, 0)) / NULLIF(t.quantity, 0) AS unit_cost_raw
  FROM public.transactions t
)
SELECT
  t.id, t.user_id, t.date AS purchase_date, t.product_name, t.jan_code, t.order_number,
  t.status,
  CASE t.status WHEN 'pending' THEN '未到货' WHEN 'in_stock' THEN '库存中' WHEN 'awaiting_payment' THEN '待入账'
    WHEN 'sold' THEN '已售出' WHEN 'returned' THEN '已退货' ELSE t.status END AS status_label,
  pp.name AS purchase_source, pm.name AS payment_method,
  t.quantity, t.quantity_sold, t.quantity_returned, t.quantity_in_stock AS quantity_unsold,
  t.unit_price, t.shipping_fee, t.purchase_price_total, t.points_total,
  round(t.unit_cost_raw, 2) AS unit_cost,
  COALESCE(s.revenue, 0) AS revenue, COALESCE(s.deductions, 0) AS deductions, COALESCE(r.return_loss, 0) AS return_loss,
  t.total_profit AS confirmed_profit, t.roi AS profit_rate,
  b.best_price, bs.best_stores, bs.best_price_updated_at,
  CASE WHEN b.best_price IS NOT NULL AND t.quantity_in_stock > 0
    THEN round((b.best_price - t.unit_cost_raw) * t.quantity_in_stock) END AS estimated_profit,
  CASE WHEN b.best_price IS NOT NULL AND t.quantity_in_stock > 0 AND t.unit_cost_raw > 0
    THEN round((b.best_price - t.unit_cost_raw) / t.unit_cost_raw * 100, 2) END AS estimated_profit_rate,
  CURRENT_DATE - t.date AS days_held,
  s.last_sale_date
FROM base t
LEFT JOIN s ON s.transaction_id = t.id
LEFT JOIN r ON r.transaction_id = t.id
LEFT JOIN best b ON b.jan = t.jan_code
LEFT JOIN best_store bs ON bs.jan = t.jan_code
LEFT JOIN public.purchase_platforms pp ON pp.id = t.purchase_platform_id
LEFT JOIN public.payment_methods pm ON pm.id = t.card_id;

-- 整体汇总（每个用户一行，对应买取X 的汇总卡片）
CREATE OR REPLACE VIEW public.assistant_overview WITH (security_invoker = true) AS
WITH u AS (
  SELECT user_id FROM public.transactions WHERE user_id IS NOT NULL
  UNION SELECT user_id FROM public.supplies_costs
), s AS (
  SELECT user_id, sum(total_profit) AS sales_profit, sum(actual_cash_spent) AS sold_cost, sum(total_selling_price) AS revenue
  FROM public.sales_records GROUP BY user_id
), r AS (
  SELECT user_id, sum(loss_amount) AS return_loss FROM public.return_records GROUP BY user_id
), e AS (
  SELECT user_id, sum(amount) AS expenses FROM public.supplies_costs GROUP BY user_id
), p AS (
  SELECT user_id,
    sum(purchase_price_total) AS total_investment,
    sum(quantity_unsold) AS unsold_qty,
    sum(round(unit_cost * quantity_unsold)) AS inventory_cost,
    sum(estimated_profit) AS estimated_profit,
    sum(CASE WHEN quantity_unsold > 0 AND best_price IS NULL THEN quantity_unsold ELSE 0 END) AS unpriced_qty
  FROM public.assistant_purchases GROUP BY user_id
)
SELECT u.user_id,
  COALESCE(p.total_investment, 0) AS total_investment,
  COALESCE(s.revenue, 0) AS revenue,
  COALESCE(s.sales_profit, 0) AS sales_profit,
  COALESCE(r.return_loss, 0) AS return_loss,
  COALESCE(e.expenses, 0) AS expenses,
  COALESCE(s.sales_profit, 0) - COALESCE(r.return_loss, 0) - COALESCE(e.expenses, 0) AS confirmed_profit,
  CASE WHEN COALESCE(s.sold_cost, 0) > 0
    THEN round((COALESCE(s.sales_profit, 0) - COALESCE(r.return_loss, 0) - COALESCE(e.expenses, 0)) / s.sold_cost * 100, 2)
    ELSE 0 END AS profit_rate,
  COALESCE(p.unsold_qty, 0) AS unsold_qty,
  COALESCE(p.inventory_cost, 0) AS inventory_cost,
  COALESCE(p.estimated_profit, 0) AS estimated_profit,
  COALESCE(p.unpriced_qty, 0) AS unpriced_qty,
  COALESCE(s.sales_profit, 0) - COALESCE(r.return_loss, 0) - COALESCE(e.expenses, 0) + COALESCE(p.estimated_profit, 0) AS total_with_estimate
FROM u
LEFT JOIN s ON s.user_id = u.user_id
LEFT JOIN r ON r.user_id = u.user_id
LEFT JOIN e ON e.user_id = u.user_id
LEFT JOIN p ON p.user_id = u.user_id;

REVOKE ALL ON public.assistant_buyback_prices FROM anon;
REVOKE ALL ON public.assistant_purchases FROM anon;
REVOKE ALL ON public.assistant_overview FROM anon;

COMMENT ON VIEW public.assistant_buyback_prices IS '每个 JAN × 买取店的最新报价（官方 API 缓存与每日 CSV 取较新）。is_stale = 该店报价超过 7 天，不作参考。';
COMMENT ON VIEW public.assistant_purchases IS '按进货汇总（与买取X 进货列表同口径）。unit_cost = (采购总价 − 三种积分) ÷ 数量；confirmed_profit = 各次出售利润 − 退货损失；quantity_unsold = 库存 + 未到货；best_price 只取 7 天内的报价；estimated_profit = (best_price − unit_cost) × quantity_unsold。';
COMMENT ON VIEW public.assistant_overview IS '每个用户的整体汇总：confirmed_profit = 销售利润 − 退货损失 − 经费；profit_rate = confirmed_profit ÷ 售出部分成本；inventory_cost = 未售数量 × 单位成本；unpriced_qty = 没有 7 天内买取价的未售数量。';
