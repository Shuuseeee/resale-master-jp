-- 18_profit_unify.sql（2026-10-10）
-- 利润算法统一成买取X，并改由数据库计算（网页与原生 App 写入的利润值都会被触发器覆盖）
-- 执行顺序：① 预览（只读，单独给出，不在本文件）→ ② 本文件（结构 + 触发器 + 导入函数 + 备份 + 重算）
-- 可重复执行；备份表只在第一次执行时创建（之后不覆盖）。新装库直接用 supabase/schema.sql。

-- 1) 退货损失额（买取X 的「損失額」：利润直接减去这个数）
ALTER TABLE public.return_records ADD COLUMN IF NOT EXISTS loss_amount numeric(10,2) DEFAULT 0 NOT NULL;

-- 2) 计算函数
-- 利润算法（与买取X 一致，2026-10-10 实测核对）：
--   单位成本 =（采购总价 − 网站积分 − 信用卡积分 − 其他积分）÷ 数量   （采购总价 = 单价 × 数量 + 运费；「使用积分」是付款方式，不减成本）
--   每次出售：利润 = 售价 × 数量 − 平台手续费 − 运费 − 单位成本 × 数量；现金利润同式但成本不减积分
--   每笔交易：利润 = 各次出售利润之和 − 退货损失额；利润率 = 利润 ÷（售出部分成本 + 退货损失额）× 100
-- 网页与原生 App 写入的利润值都会被这里覆盖，算法只在数据库维护一份。

-- 出售写入 / 修改时按所属交易计算利润（BEFORE INSERT OR UPDATE ON sales_records）
CREATE OR REPLACE FUNCTION public.calc_sale_profit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  t record;
  gross_unit numeric;
  net_unit numeric;
  revenue numeric;
  fees numeric;
  basis numeric;
BEGIN
  SELECT purchase_price_total, quantity, expected_platform_points, expected_card_points, extra_platform_points
  INTO t FROM transactions WHERE id = NEW.transaction_id;
  IF NOT FOUND OR COALESCE(t.quantity, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  gross_unit := COALESCE(t.purchase_price_total, 0) / t.quantity;
  net_unit := (COALESCE(t.purchase_price_total, 0) - COALESCE(t.expected_platform_points, 0)
    - COALESCE(t.expected_card_points, 0) - COALESCE(t.extra_platform_points, 0)) / t.quantity;
  revenue := NEW.quantity_sold * NEW.selling_price_per_unit;
  fees := COALESCE(NEW.platform_fee, 0) + COALESCE(NEW.shipping_fee, 0);
  basis := net_unit * NEW.quantity_sold;

  NEW.cash_profit := round(revenue - fees - gross_unit * NEW.quantity_sold, 2);
  NEW.total_profit := round(revenue - fees - basis, 2);
  NEW.actual_cash_spent := round(basis, 2);
  NEW.roi := CASE WHEN basis > 0 THEN round((revenue - fees - basis) / basis * 100, 2) ELSE 0 END;
  RETURN NEW;
END;
$function$;

-- 交易的利润合计：每次写交易时从出售 / 退货重新汇总（BEFORE INSERT OR UPDATE ON transactions）
CREATE OR REPLACE FUNCTION public.calc_transaction_profit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  n_sales integer;
  sum_profit numeric;
  sum_cash numeric;
  sum_basis numeric;
  loss numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.cash_profit := NULL;
    NEW.total_profit := NULL;
    NEW.roi := NULL;
    RETURN NEW;
  END IF;

  SELECT count(*), COALESCE(sum(total_profit), 0), COALESCE(sum(cash_profit), 0), COALESCE(sum(actual_cash_spent), 0)
  INTO n_sales, sum_profit, sum_cash, sum_basis
  FROM sales_records WHERE transaction_id = NEW.id;
  SELECT COALESCE(sum(loss_amount), 0) INTO loss FROM return_records WHERE transaction_id = NEW.id;

  IF n_sales = 0 AND loss = 0 THEN
    NEW.cash_profit := NULL;
    NEW.total_profit := NULL;
    NEW.roi := NULL;
  ELSE
    NEW.total_profit := sum_profit - loss;
    NEW.cash_profit := sum_cash - loss;
    NEW.roi := CASE WHEN sum_basis + loss > 0 THEN round((sum_profit - loss) / (sum_basis + loss) * 100, 2) ELSE 0 END;
  END IF;
  RETURN NEW;
END;
$function$;

-- 出售 / 退货变动后让所属交易重新汇总（AFTER ON sales_records / return_records）
CREATE OR REPLACE FUNCTION public.touch_transaction_profit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE transactions SET total_profit = total_profit
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 交易的成本相关字段改动后，重算它名下每次出售的利润（AFTER UPDATE ON transactions）
CREATE OR REPLACE FUNCTION public.recalc_sales_on_cost_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF (NEW.purchase_price_total, NEW.quantity, NEW.expected_platform_points, NEW.expected_card_points, NEW.extra_platform_points)
     IS DISTINCT FROM
     (OLD.purchase_price_total, OLD.quantity, OLD.expected_platform_points, OLD.expected_card_points, OLD.extra_platform_points) THEN
    UPDATE sales_records SET total_profit = total_profit WHERE transaction_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3) 触发器
DROP TRIGGER IF EXISTS trg_calc_sale_profit ON public.sales_records;
DROP TRIGGER IF EXISTS trg_calc_transaction_profit ON public.transactions;
DROP TRIGGER IF EXISTS trg_recalc_sales_on_cost_change ON public.transactions;
DROP TRIGGER IF EXISTS trg_touch_profit_on_sale ON public.sales_records;
DROP TRIGGER IF EXISTS trg_touch_profit_on_return ON public.return_records;
CREATE TRIGGER trg_calc_sale_profit BEFORE INSERT OR UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.calc_sale_profit();
CREATE TRIGGER trg_calc_transaction_profit BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.calc_transaction_profit();
CREATE TRIGGER trg_recalc_sales_on_cost_change AFTER UPDATE OF purchase_price_total, quantity, expected_platform_points, expected_card_points, extra_platform_points ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.recalc_sales_on_cost_change();
CREATE TRIGGER trg_touch_profit_on_sale AFTER INSERT OR DELETE OR UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_profit();
CREATE TRIGGER trg_touch_profit_on_return AFTER INSERT OR DELETE OR UPDATE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_profit();

-- 4) 导入函数：不再接收前端算的利润，写入退货损失额
-- 买取X 格式的整份导入（lib/api/order-import.ts 调用）：一个事务里写进货 / 出售 / 退货 / 经费，任何一步出错整份回滚。
-- 积分平台、支付方式等由前端放进 payload；这里负责去重、补建平台、写入与状态。利润由 calc_sale_profit / calc_transaction_profit 触发器计算。
-- 去重：同一用户已有「日期 + 商品名 + 数量 + 单价 + 订单ID（为空时用 JAN）」相同的进货就整笔跳过（含它的出售 / 退货）。
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
  tx_id uuid;
  pp_id uuid;
  sp_id uuid;
  sold_qty integer;
  n_purchases integer := 0;
  n_skipped integer := 0;
  n_sales integer := 0;
  n_returns integer := 0;
  n_expenses integer := 0;
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
      user_id, date, product_name, jan_code, unit_price, quantity, shipping_fee,
      purchase_price_total, card_paid, point_paid, balance_paid, card_id,
      expected_platform_points, expected_card_points, extra_platform_points,
      platform_points_platform_id, card_points_platform_id, extra_platform_points_platform_id,
      purchase_platform_id, order_number, notes, status
    ) VALUES (
      uid, (p->>'date')::date, p->>'product_name', NULLIF(p->>'jan_code', ''), (p->>'unit_price')::numeric,
      (p->>'quantity')::integer, COALESCE((p->>'shipping_fee')::numeric, 0),
      (p->>'purchase_price_total')::numeric, (p->>'card_paid')::numeric, (p->>'point_paid')::numeric, 0,
      NULLIF(p->>'card_id', '')::uuid,
      (p->>'expected_platform_points')::numeric, (p->>'expected_card_points')::numeric, (p->>'extra_platform_points')::numeric,
      NULLIF(p->>'platform_points_platform_id', '')::uuid, NULLIF(p->>'card_points_platform_id', '')::uuid,
      NULLIF(p->>'extra_platform_points_platform_id', '')::uuid,
      pp_id, NULLIF(p->>'order_number', ''), NULLIF(p->>'notes', ''),
      CASE WHEN (p->>'arrived')::boolean THEN 'in_stock' ELSE 'pending' END
    ) RETURNING id INTO tx_id;
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
    'purchases', n_purchases, 'skipped', n_skipped, 'sales', n_sales, 'returns', n_returns, 'expenses', n_expenses
  );
END;
$function$;


-- 5) 备份现有利润（backup schema 不经 API 暴露；只在第一次执行时创建）
CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE IF NOT EXISTS backup.profit_20261010 AS
  SELECT 'sales_records'::text AS tbl, id, cash_profit, total_profit, roi, actual_cash_spent FROM public.sales_records
  UNION ALL
  SELECT 'transactions'::text, id, cash_profit, total_profit, roi, NULL::numeric FROM public.transactions;

-- 6) 按新公式重算现有数据（重算期间暂停状态触发器，避免顺带改动交易状态）
BEGIN;
ALTER TABLE public.sales_records DISABLE TRIGGER trigger_update_status_on_sale;
UPDATE public.sales_records SET total_profit = total_profit;
ALTER TABLE public.sales_records ENABLE TRIGGER trigger_update_status_on_sale;
UPDATE public.transactions SET total_profit = total_profit;
COMMIT;
