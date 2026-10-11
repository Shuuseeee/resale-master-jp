-- 27_transaction_arrivals.sql（2026-10-11）
-- 分批到货（对齐买取X「着荷」）：
--   · transaction_arrivals 一次到货一行（日期 / 数量 / 备注）；合计由触发器写进 transactions.quantity_arrived
--   · 状态：一件没到 = 未到货（pending），到了 1 件以上 = 库存中（in_stock），界面另显示「到货 3/5」
--   · 只能出售已到货的数量（出售记录写入前由触发器校验）
--   · 没有到货明细的交易（老数据、原生 App 标记的到货）quantity_arrived 为 NULL，按状态推断：未到货 = 0，其余 = 全部到齐。原生 App 不用改
--   · 交易被改回「未到货」时自动清掉到货明细
--   · 导入「着荷」表写入明细；给 MCP 用的 assistant_purchases 视图多一列 quantity_arrived_unsold（已到货未售，出货方案只用这部分）
-- 可重复执行。

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS quantity_arrived integer;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_quantity_arrived_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_arrived_check CHECK (((quantity_arrived IS NULL) OR (quantity_arrived >= 0)));

CREATE TABLE IF NOT EXISTS public.transaction_arrivals (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arrived_date date DEFAULT ((now() AT TIME ZONE 'Asia/Tokyo'::text))::date NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transaction_arrivals_transaction_id ON public.transaction_arrivals USING btree (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_arrivals_user_id ON public.transaction_arrivals USING btree (user_id);

ALTER TABLE public.transaction_arrivals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own arrivals" ON public.transaction_arrivals;
CREATE POLICY "Users manage their own arrivals" ON public.transaction_arrivals
  FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE OR REPLACE FUNCTION public.sync_transaction_arrivals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  tx_id uuid := COALESCE(NEW.transaction_id, OLD.transaction_id);
  n integer;
  total integer;
  q integer;
  sold integer;
BEGIN
  SELECT quantity, COALESCE(quantity_sold, 0) INTO q, sold FROM transactions WHERE id = tx_id;
  IF q IS NULL THEN
    RETURN NULL; -- 交易已删除（级联删除到货明细时）
  END IF;
  SELECT count(*), COALESCE(sum(quantity), 0) INTO n, total FROM transaction_arrivals WHERE transaction_id = tx_id;
  IF total > q THEN
    RAISE EXCEPTION '到货数量合计（%）超过进货数量（%）', total, q;
  END IF;
  IF total < sold THEN
    RAISE EXCEPTION '到货数量合计（%）不能少于已售数量（%）', total, sold;
  END IF;
  UPDATE transactions SET
    quantity_arrived = CASE WHEN n = 0 THEN NULL ELSE total END,
    status = CASE
      WHEN status = 'pending' AND total > 0 THEN 'in_stock'
      WHEN status = 'in_stock' AND total = 0 AND sold = 0 THEN 'pending'
      ELSE status END
  WHERE id = tx_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_arrivals_on_pending()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM transaction_arrivals WHERE transaction_id = NEW.id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_sale_within_arrived()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  arrived integer;
  other_sold integer;
BEGIN
  SELECT COALESCE(quantity_arrived, CASE WHEN status = 'pending' THEN 0 ELSE quantity END) INTO arrived
  FROM transactions WHERE id = NEW.transaction_id;
  SELECT COALESCE(sum(quantity_sold), 0) INTO other_sold
  FROM sales_records WHERE transaction_id = NEW.transaction_id AND id IS DISTINCT FROM NEW.id;
  IF other_sold + NEW.quantity_sold > arrived THEN
    RAISE EXCEPTION '只能出售已到货的数量（已到货 % 个，已售 % 个）', arrived, other_sold;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.import_order_data(p_purchases jsonb, p_expenses jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  p jsonb;
  s jsonb;
  r jsonb;
  e jsonb;
  a jsonb;
  tx_id uuid;
  pp_id uuid;
  sp_id uuid;
  sold_qty integer;
  n_purchases integer := 0;
  n_skipped integer := 0;
  n_sales integer := 0;
  n_returns integer := 0;
  n_expenses integer := 0;
  n_arrivals integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  FOR p IN SELECT * FROM jsonb_array_elements(COALESCE(p_purchases, '[]'::jsonb)) LOOP
    IF EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.user_id = uid
        AND t.date = (p->>'date')::date
        AND t.product_name = p->>'product_name'
        AND t.quantity = (p->>'quantity')::integer
        AND COALESCE(t.unit_price, 0) = COALESCE((p->>'unit_price')::numeric, 0)
        AND COALESCE(NULLIF(t.order_number, ''), t.jan_code, '') = COALESCE(NULLIF(p->>'order_number', ''), NULLIF(p->>'jan_code', ''), '')
    ) THEN
      n_skipped := n_skipped + 1;
      CONTINUE;
    END IF;

    pp_id := NULL;
    IF COALESCE(p->>'platform_name', '') <> '' THEN
      SELECT id INTO pp_id FROM purchase_platforms
      WHERE name = p->>'platform_name' AND (is_builtin OR user_id = uid)
      ORDER BY is_builtin DESC
      LIMIT 1;
      IF pp_id IS NULL THEN
        INSERT INTO purchase_platforms (user_id, name) VALUES (uid, p->>'platform_name') RETURNING id INTO pp_id;
      END IF;
    END IF;

    INSERT INTO transactions (
      user_id, date, product_name, jan_code, unit_price, quantity, shipping_fee, coupon_amount,
      purchase_price_total, card_paid, point_paid, balance_paid, card_id,
      expected_platform_points, expected_card_points, extra_platform_points,
      platform_points_platform_id, card_points_platform_id, extra_platform_points_platform_id,
      purchase_platform_id, order_number, notes, status
    ) VALUES (
      uid, (p->>'date')::date, p->>'product_name', NULLIF(p->>'jan_code', ''), (p->>'unit_price')::numeric,
      (p->>'quantity')::integer, COALESCE((p->>'shipping_fee')::numeric, 0), COALESCE((p->>'coupon_amount')::numeric, 0),
      (p->>'purchase_price_total')::numeric, (p->>'card_paid')::numeric, (p->>'point_paid')::numeric, 0,
      NULLIF(p->>'card_id', '')::uuid,
      (p->>'expected_platform_points')::numeric, (p->>'expected_card_points')::numeric, (p->>'extra_platform_points')::numeric,
      NULLIF(p->>'platform_points_platform_id', '')::uuid, NULLIF(p->>'card_points_platform_id', '')::uuid,
      NULLIF(p->>'extra_platform_points_platform_id', '')::uuid,
      pp_id, NULLIF(p->>'order_number', ''), NULLIF(p->>'notes', ''),
      CASE WHEN (p->>'arrived')::boolean THEN 'in_stock' ELSE 'pending' END
    ) RETURNING id INTO tx_id;

    -- 到货明细先于出售写入：出售受「只能卖已到货」约束
    FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p->'arrivals', '[]'::jsonb)) LOOP
      INSERT INTO transaction_arrivals (transaction_id, user_id, arrived_date, quantity, notes)
      VALUES (tx_id, uid, COALESCE((a->>'arrived_date')::date, (p->>'date')::date), (a->>'quantity')::integer, NULLIF(a->>'notes', ''));
      n_arrivals := n_arrivals + 1;
    END LOOP;
    n_purchases := n_purchases + 1;

    sold_qty := 0;
    FOR s IN SELECT * FROM jsonb_array_elements(COALESCE(p->'sales', '[]'::jsonb)) LOOP
      sp_id := NULL;
      IF COALESCE(s->>'platform_name', '') <> '' THEN
        SELECT id INTO sp_id FROM selling_platforms
        WHERE name = s->>'platform_name' AND (is_builtin OR user_id = uid)
        ORDER BY is_builtin DESC
        LIMIT 1;
        IF sp_id IS NULL THEN
          INSERT INTO selling_platforms (user_id, name) VALUES (uid, s->>'platform_name') RETURNING id INTO sp_id;
        END IF;
      END IF;
      INSERT INTO sales_records (
        transaction_id, user_id, quantity_sold, selling_price_per_unit, platform_fee, shipping_fee, sale_date,
        selling_platform_id, sale_order_number, notes
      ) VALUES (
        tx_id, uid, (s->>'quantity_sold')::integer, (s->>'selling_price_per_unit')::numeric, (s->>'platform_fee')::numeric, 0,
        (s->>'sale_date')::date, sp_id, NULLIF(s->>'sale_order_number', ''), NULLIF(s->>'notes', '')
      );
      sold_qty := sold_qty + (s->>'quantity_sold')::integer;
      n_sales := n_sales + 1;
    END LOOP;

    -- 全部卖出且每条出售都已入账 → 已售出（否则由出售触发器定为待入账 / 库存中）
    IF COALESCE((p->>'paid_all')::boolean, false) AND sold_qty >= (p->>'quantity')::integer THEN
      UPDATE transactions SET status = 'sold' WHERE id = tx_id;
    END IF;

    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p->'returns', '[]'::jsonb)) LOOP
      INSERT INTO return_records (transaction_id, user_id, quantity_returned, return_date, return_amount, points_deducted, loss_amount, notes)
      VALUES (tx_id, uid, (r->>'quantity_returned')::integer, (r->>'return_date')::date, (r->>'return_amount')::numeric, 0,
        COALESCE((r->>'loss_amount')::numeric, 0), NULLIF(r->>'notes', ''));
      n_returns := n_returns + 1;
    END LOOP;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_expenses, '[]'::jsonb)) LOOP
    INSERT INTO supplies_costs (user_id, category, amount, purchase_date, description, notes)
    VALUES (uid, e->>'category', (e->>'amount')::numeric, (e->>'purchase_date')::date, NULLIF(e->>'description', ''), NULLIF(e->>'notes', ''));
    n_expenses := n_expenses + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'purchases', n_purchases, 'skipped', n_skipped, 'sales', n_sales, 'returns', n_returns, 'expenses', n_expenses, 'arrivals', n_arrivals
  );
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_transaction_arrivals ON public.transaction_arrivals;
CREATE TRIGGER trg_sync_transaction_arrivals AFTER INSERT OR DELETE OR UPDATE ON public.transaction_arrivals FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_arrivals();
DROP TRIGGER IF EXISTS trg_clear_arrivals_on_pending ON public.transactions;
CREATE TRIGGER trg_clear_arrivals_on_pending AFTER UPDATE OF status ON public.transactions FOR EACH ROW WHEN (((new.status = 'pending'::text) AND (old.status <> 'pending'::text))) EXECUTE FUNCTION public.clear_arrivals_on_pending();
DROP TRIGGER IF EXISTS trg_check_sale_within_arrived ON public.sales_records;
CREATE TRIGGER trg_check_sale_within_arrived BEFORE INSERT OR UPDATE OF quantity_sold, transaction_id ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.check_sale_within_arrived();

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
  s.last_sale_date,
  GREATEST(LEAST(t.quantity_in_stock,
    COALESCE(t.quantity_arrived, CASE WHEN t.status = 'pending' THEN 0 ELSE t.quantity END)
      - COALESCE(t.quantity_sold, 0) - COALESCE(t.quantity_returned, 0)), 0) AS quantity_arrived_unsold
FROM base t
LEFT JOIN s ON s.transaction_id = t.id
LEFT JOIN r ON r.transaction_id = t.id
LEFT JOIN best b ON b.jan = t.jan_code
LEFT JOIN best_store bs ON bs.jan = t.jan_code
LEFT JOIN public.purchase_platforms pp ON pp.id = t.purchase_platform_id
LEFT JOIN public.payment_methods pm ON pm.id = t.card_id;

-- 核对（只读）：应返回 1 / 1 / 3 / 1
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_arrivals') AS 到货表,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'quantity_arrived') AS 到货数量列,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_sync_transaction_arrivals', 'trg_clear_arrivals_on_pending', 'trg_check_sale_within_arrived')) AS 触发器,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assistant_purchases' AND column_name = 'quantity_arrived_unsold') AS 视图新列;
