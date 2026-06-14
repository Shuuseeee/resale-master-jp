-- supabase/migrations/15_sale_orders.sql
-- 新增销售订单实体，支持多件商品作为同一订单售出

-- ============================================
-- PART 1: sale_orders 表（订单共享字段）
-- 金额不冗余存储，一律从 sales_records 聚合
-- ============================================
CREATE TABLE IF NOT EXISTS sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  selling_platform_id UUID REFERENCES selling_platforms(id),
  sale_order_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_orders_user_id ON sale_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_orders_sale_date ON sale_orders(sale_date);

-- user_id 自动填充（复用 00_initial_schema.sql:443 的 set_user_id()）
DROP TRIGGER IF EXISTS set_user_id_sale_orders ON sale_orders;
CREATE TRIGGER set_user_id_sale_orders
  BEFORE INSERT ON sale_orders
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

ALTER TABLE sale_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sale orders"
  ON sale_orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own sale orders"
  ON sale_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own sale orders"
  ON sale_orders FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own sale orders"
  ON sale_orders FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE sale_orders IS '販売注文テーブル - 複数取引を同一注文として管理';

-- ============================================
-- PART 2: sales_records に sale_group_id を追加
-- ON DELETE SET NULL: 订单删除时只解散分组，保留各条销售记录
-- （避免 CASCADE 误触发库存回滚等财务副作用）
-- ============================================
ALTER TABLE sales_records
  ADD COLUMN IF NOT EXISTS sale_group_id UUID
    REFERENCES sale_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_records_sale_group_id
  ON sales_records(sale_group_id);

-- ============================================
-- PART 3: 订单级汇总视图
-- 底表 RLS 已按 user_id 隔离，视图无需额外策略
-- ============================================
CREATE OR REPLACE VIEW sale_order_summary AS
SELECT
  o.id                                                  AS sale_group_id,
  o.user_id,
  o.sale_date,
  o.selling_platform_id,
  o.sale_order_number,
  o.notes,
  o.created_at,
  COUNT(s.id)                                           AS item_count,
  COALESCE(SUM(s.total_selling_price), 0)               AS total_selling_price,
  COALESCE(SUM(s.platform_fee + s.shipping_fee), 0)     AS total_fees,
  COALESCE(SUM(s.total_profit), 0)                      AS total_profit,
  COALESCE(SUM(s.cash_profit), 0)                       AS total_cash_profit,
  COALESCE(SUM(s.actual_cash_spent), 0)                 AS total_cash_spent
FROM sale_orders o
LEFT JOIN sales_records s ON s.sale_group_id = o.id
GROUP BY o.id;

COMMENT ON VIEW sale_order_summary IS '販売注文サマリービュー - 注文ごとに利益・費用を集計';
