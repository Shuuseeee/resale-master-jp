-- 29_sale_payment_received.sql（2026-10-14）
-- 「已入账」改记在每次出售上（照买取X 的 sales.payment_received）：
--   · 部分售出时，已卖的那几件也能单独确认入账（之前要等整笔卖完变成「待入账」才能记）
--   · 同一笔进货分两单卖、一单先到账也能表达
-- 交易状态仍保留 待入账 / 已售出（原生 App 只认交易状态，不用改）：
--   · 全部卖完 + 每次出售都已入账 → 已售出；全部卖完 + 还有没入账的 → 待入账
--   · 有人直接把交易改成「已售出」（原生 App、网页旧入口）→ 它名下的出售全部标为已入账
--   · 把「已售出」改回「待入账」→ 名下的出售全部改回未入账
-- 可重复执行。

-- ① 新列
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS payment_received boolean DEFAULT false NOT NULL;

-- ② 回填：除了「待入账」交易的出售，其余一律视为已入账。
--    这样升级后「待入账」里看到的和升级前完全一样；之前部分售出的那些出售不会一下子全冒出来
--    （以前没有地方记它们有没有到账，按已到账处理）。回填时关掉出售表的触发器，避免逐行重算利润 / 状态。
BEGIN;
ALTER TABLE public.sales_records DISABLE TRIGGER USER;
UPDATE public.sales_records s
SET payment_received = true
FROM public.transactions t
WHERE t.id = s.transaction_id
  AND t.status <> 'awaiting_payment'
  AND NOT s.payment_received;
ALTER TABLE public.sales_records ENABLE TRIGGER USER;
COMMIT;

-- ③ 出售变动后重算交易状态：考虑每次出售的入账
CREATE OR REPLACE FUNCTION public.update_transaction_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  tx_id uuid := COALESCE(NEW.transaction_id, OLD.transaction_id);
  trans_quantity INTEGER;
  trans_status TEXT;
  sold_qty INTEGER;
  unpaid INTEGER;
BEGIN
  SELECT quantity, status INTO trans_quantity, trans_status
  FROM transactions WHERE id = tx_id;

  -- 不自动改动 未到货 / 已退货
  IF trans_status IN ('pending', 'returned') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 已售出（用户确认过）保持不动，只有把某次出售改回「未入账」时退回待入账
  IF trans_status = 'sold' THEN
    IF TG_OP = 'UPDATE' AND OLD.payment_received AND NOT NEW.payment_received THEN
      UPDATE transactions SET status = 'awaiting_payment' WHERE id = tx_id AND status = 'sold';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(quantity_sold), 0), COUNT(*) FILTER (WHERE NOT payment_received)
  INTO sold_qty, unpaid
  FROM sales_records WHERE transaction_id = tx_id;

  IF sold_qty >= trans_quantity THEN
    IF unpaid = 0 THEN
      UPDATE transactions SET status = 'sold' WHERE id = tx_id AND status <> 'sold';
    ELSE
      UPDATE transactions SET status = 'awaiting_payment' WHERE id = tx_id AND status <> 'awaiting_payment';
    END IF;
  ELSE
    UPDATE transactions SET status = 'in_stock' WHERE id = tx_id AND status <> 'in_stock';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ④ 交易被直接改成「已售出」/ 从「已售出」改回「待入账」时，同步名下出售的入账
CREATE OR REPLACE FUNCTION public.sync_sales_payment_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 由出售触发器（③）连带改的状态不回头再改出售（只改一次出售的入账，不能把整笔都带走）
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'sold' THEN
    UPDATE sales_records SET payment_received = true
    WHERE transaction_id = NEW.id AND NOT payment_received;
  ELSIF NEW.status = 'awaiting_payment' AND OLD.status = 'sold' THEN
    UPDATE sales_records SET payment_received = false
    WHERE transaction_id = NEW.id AND payment_received;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_sales_payment_on_status ON public.transactions;
CREATE TRIGGER trg_sync_sales_payment_on_status AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW WHEN ((new.status IS DISTINCT FROM old.status) AND (new.status IN ('sold', 'awaiting_payment')))
  EXECUTE FUNCTION public.sync_sales_payment_on_status();

-- ⑤ 导入：每次出售按文件里的「入金済み」写入，交易状态交给出售触发器（不再用整笔的 paid_all）
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
        selling_platform_id, sale_order_number, notes, payment_received
      ) VALUES (
        tx_id, uid, (s->>'quantity_sold')::integer, (s->>'selling_price_per_unit')::numeric, (s->>'platform_fee')::numeric, 0,
        (s->>'sale_date')::date, sp_id, NULLIF(s->>'sale_order_number', ''), NULLIF(s->>'notes', ''),
        COALESCE((s->>'paid')::boolean, false)
      );
      sold_qty := sold_qty + (s->>'quantity_sold')::integer;
      n_sales := n_sales + 1;
    END LOOP;

    -- 全部卖出且每条出售都已入账 → 已售出、否则待入账 / 库存中：都由出售触发器按每次出售的入账决定

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

-- ⑥ 检查：待入账交易里没有任何未入账出售的（应为 0 行）
SELECT t.id, t.product_name FROM public.transactions t
WHERE t.status = 'awaiting_payment'
  AND NOT EXISTS (SELECT 1 FROM public.sales_records s WHERE s.transaction_id = t.id AND NOT s.payment_received);
