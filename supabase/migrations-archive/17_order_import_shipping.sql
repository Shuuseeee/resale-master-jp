-- 17_order_import_shipping.sql（2026-10-10）
-- 1) 进货运费：transactions.shipping_fee（已计入 purchase_price_total，这里单独记录金额）
-- 2) 编辑历史追踪运费
-- 3) 买取X 格式整份导入函数 import_order_data（一个事务内完成，出错整份回滚）
-- 已有库执行本文件即可；新装库直接用 supabase/schema.sql（已包含以上内容）

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS shipping_fee numeric(10,2) DEFAULT 0 NOT NULL;

CREATE OR REPLACE FUNCTION public.record_transaction_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  tracked_fields TEXT[] := ARRAY[
    'product_name','date','purchase_price_total','unit_price','shipping_fee','quantity',
    'card_paid','point_paid','balance_paid',
    'expected_platform_points','expected_card_points','extra_platform_points',
    'jan_code','order_number','notes','status','image_url',
    'purchase_platform_id','card_id'
  ];
  old_json JSONB := to_jsonb(OLD);
  new_json JSONB := to_jsonb(NEW);
  old_diff JSONB := '{}'::JSONB;
  new_diff JSONB := '{}'::JSONB;
  field TEXT;
BEGIN
  FOREACH field IN ARRAY tracked_fields LOOP
    IF old_json->field IS DISTINCT FROM new_json->field THEN
      old_diff := old_diff || jsonb_build_object(field, old_json->field);
      new_diff := new_diff || jsonb_build_object(field, new_json->field);
    END IF;
  END LOOP;

  IF old_diff <> '{}'::JSONB THEN
    INSERT INTO transaction_history(transaction_id, user_id, old_values, new_values)
    VALUES (NEW.id, auth.uid(), old_diff, new_diff);
  END IF;

  RETURN NEW;
END;
$function$;

-- 买取X 格式的整份导入（lib/api/order-import.ts 调用）：一个事务里写进货 / 出售 / 退货 / 经费，任何一步出错整份回滚。
-- 利润、积分平台、支付方式等由前端算好放进 payload；这里只负责去重、补建平台、写入与状态。
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
      purchase_platform_id, order_number, notes, status, cash_profit, total_profit, roi
    ) VALUES (
      uid, (p->>'date')::date, p->>'product_name', NULLIF(p->>'jan_code', ''), (p->>'unit_price')::numeric,
      (p->>'quantity')::integer, COALESCE((p->>'shipping_fee')::numeric, 0),
      (p->>'purchase_price_total')::numeric, (p->>'card_paid')::numeric, (p->>'point_paid')::numeric, 0,
      NULLIF(p->>'card_id', '')::uuid,
      (p->>'expected_platform_points')::numeric, (p->>'expected_card_points')::numeric, (p->>'extra_platform_points')::numeric,
      NULLIF(p->>'platform_points_platform_id', '')::uuid, NULLIF(p->>'card_points_platform_id', '')::uuid,
      NULLIF(p->>'extra_platform_points_platform_id', '')::uuid,
      pp_id, NULLIF(p->>'order_number', ''), NULLIF(p->>'notes', ''),
      CASE WHEN (p->>'arrived')::boolean THEN 'in_stock' ELSE 'pending' END,
      (p->>'cash_profit')::numeric, (p->>'total_profit')::numeric, (p->>'roi')::numeric
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
        cash_profit, total_profit, roi, actual_cash_spent, selling_platform_id, sale_order_number, notes
      ) VALUES (
        tx_id, uid, (s->>'quantity_sold')::integer, (s->>'selling_price_per_unit')::numeric, (s->>'platform_fee')::numeric, 0,
        (s->>'sale_date')::date, (s->>'cash_profit')::numeric, (s->>'total_profit')::numeric, (s->>'roi')::numeric,
        (s->>'actual_cash_spent')::numeric, sp_id, NULLIF(s->>'sale_order_number', ''), NULLIF(s->>'notes', '')
      );
      sold_qty := sold_qty + (s->>'quantity_sold')::integer;
      n_sales := n_sales + 1;
    END LOOP;

    -- 全部卖出且每条出售都已入账 → 已售出（否则由出售触发器定为待入账 / 库存中）
    IF COALESCE((p->>'paid_all')::boolean, false) AND sold_qty >= (p->>'quantity')::integer THEN
      UPDATE transactions SET status = 'sold' WHERE id = tx_id;
    END IF;

    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p->'returns', '[]'::jsonb)) LOOP
      INSERT INTO return_records (transaction_id, user_id, quantity_returned, return_date, return_amount, points_deducted, notes)
      VALUES (tx_id, uid, (r->>'quantity_returned')::integer, (r->>'return_date')::date, (r->>'return_amount')::numeric, 0, NULLIF(r->>'notes', ''));
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
