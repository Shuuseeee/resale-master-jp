-- ============================================================
-- resale-master-jp 完整数据库结构（新装唯一入口）
--
-- 用法：在【全新】的 Supabase 项目里，于 SQL Editor 一次性执行本文件即可。
--       不需要再执行 supabase/migrations-archive/ 下的任何文件。
-- 注意：仅适用于空库。表/约束/策略均为非幂等写法，在已有数据的库里重复执行会报错（这是有意的，避免误覆盖）。
--
-- 生成方式：2026-10-07 从线上库（Supabase 项目 yfwhrknrhdzkricoxvfh，public + storage 相关对象）
--           只读导出后整理。不含任何用户数据，也不含管理员种子数据。
--
-- 与线上库的差异：
--   已对齐（2026-10-07 线上库已按本文件补齐）：
--     · user_line_links 启用 RLS + 显式拒绝策略
--     · sale_order_summary / jan_thumbnail_queue_status 视图加 security_invoker，并对 anon 撤权
--       （否则视图以属主身份绕过 RLS，未登录用户也能读到全站数据）
--   仍有差异：
--     · notifications 加入 supabase_realtime publication（迁移 16 的意图；线上库未加入。
--       web 端已移除通知，仅原生 App 订阅它）
--     · 不含 watch_dashboard()：线上库有，是原生 Apple Watch 复合功能依赖的 RPC，
--       SQL 留档在原生仓库 supabase/migrations/20260730_watch_dashboard.sql。
--       需要 Watch 功能的新库，请另行执行该文件
--
-- 管理员：新装后，注册第一个用户，再在 SQL Editor 里手动执行：
--   INSERT INTO public.user_roles (user_id, role)
--   SELECT id, 'admin' FROM auth.users WHERE email = '你的邮箱';
-- ============================================================


-- ============================================================
-- 1. 表
-- ============================================================

CREATE TABLE public.coupon_usage_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  coupon_id uuid NOT NULL,
  user_id uuid NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  discount_amount numeric(10,2),
  transaction_amount numeric(10,2),
  store_name text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.coupons (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  discount_type text DEFAULT 'fixed_amount'::text NOT NULL,
  discount_value numeric(10,2) DEFAULT 0 NOT NULL,
  min_purchase_amount numeric(10,2) DEFAULT 0 NOT NULL,
  expiry_date date NOT NULL,
  is_used boolean DEFAULT false NOT NULL,
  used_date date,
  platform text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  start_date date,
  coupon_code text,
  max_discount_amount numeric(10,2) DEFAULT 0,
  target_item_name text,
  target_item_value numeric(10,2) DEFAULT 0,
  usage_limit integer DEFAULT 1,
  usage_count integer DEFAULT 0,
  monthly_usage_cap numeric(10,2),
  per_transaction_cap numeric(10,2),
  time_restriction text,
  day_of_week_restriction text,
  recurring_dates text,
  target_category text,
  excluded_items text,
  redemption_method text DEFAULT 'barcode'::text,
  barcode_value text,
  can_stack_with_other_coupons boolean DEFAULT false,
  can_stack_with_point_multiplier boolean DEFAULT true,
  can_stack_with_sale_price boolean DEFAULT false,
  requires_membership boolean DEFAULT false,
  membership_type text,
  is_first_time_only boolean DEFAULT false,
  store_restriction text,
  is_online_only boolean DEFAULT false,
  is_offline_only boolean DEFAULT false,
  combo_quantity integer,
  combo_price numeric(10,2),
  cashback_timing text,
  cashback_type text,
  campaign_name text,
  quantity_limit integer,
  quantity_used integer DEFAULT 0,
  line_user_id text,
  wechat_openid text
);

CREATE TABLE public.fixed_costs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric(10,2) DEFAULT 0 NOT NULL,
  billing_cycle text DEFAULT 'monthly'::text NOT NULL,
  start_date date DEFAULT CURRENT_DATE NOT NULL,
  end_date date,
  is_active boolean DEFAULT true NOT NULL,
  category text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.jan_thumbnail_cache (
  jan text NOT NULL,
  image_url text,
  image_fetched_at timestamp with time zone,
  image_fetch_failed_count smallint DEFAULT 0 NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.jan_thumbnail_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  jan text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 买取X「全部买取数据」CSV 的每日同步结果：当时至少有一家店报价的全部商品（约 2 万件），全站共享。
-- prices 为 [{store, price, updated_at}]，updated_at 是该店报价的更新时间（ISO）；
-- 用于输入 JAN 时自动补全商品名等只读查询，写入走 service_role（/api/kaitorix/catalog-sync）。
CREATE TABLE public.kaitorix_catalog (
  jan text NOT NULL,
  name text NOT NULL,
  category text,
  msrp integer,
  prices jsonb DEFAULT '[]'::jsonb NOT NULL,
  max_price integer DEFAULT 0 NOT NULL,
  synced_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kaitorix_open_api_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  usage_date date NOT NULL,
  used_count integer DEFAULT 0 NOT NULL,
  last_limit integer DEFAULT 30 NOT NULL,
  last_remaining integer,
  last_reset_at timestamp with time zone,
  last_status integer,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kaitorix_price_cache (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  jan text NOT NULL,
  product_name text,
  max_price integer DEFAULT 0,
  max_store text,
  prices jsonb DEFAULT '[]'::jsonb,
  fetched_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  raw_response jsonb,
  last_fetch_source text DEFAULT 'scraper'::text
);

-- 买取价历史：每日 CSV 同步时，某家店对某个 JAN 的报价与上一次不同才追加一行（只记变动）。
-- price 为 NULL 表示该店不再报价（下架 / 停止买取）。observed_at 取 CSV 里该店报价的取得时间，
-- 没有则为同步当天（JST）0 点；主键包含 observed_at，重跑同一天的同步不会产生重复行。
-- 写入走 service_role（/api/kaitorix/catalog-sync），登录用户只读。
CREATE TABLE public.kaitorix_price_history (
  jan text NOT NULL,
  store text NOT NULL,
  observed_at timestamp with time zone NOT NULL,
  price integer
);

CREATE TABLE public.kaitorix_scrape_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  jan text NOT NULL,
  user_id uuid,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  type text DEFAULT 'coupon_alert'::text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.payment_methods (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'card'::text NOT NULL,
  closing_day integer,
  payment_day integer,
  payment_same_month boolean DEFAULT false NOT NULL,
  point_rate numeric(6,4) DEFAULT 1.0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  card_points_platform_id uuid,
  card_last4 text
);

-- 支付方式的店铺特殊规则：同一支付方式在某个进货平台用不同返点率（如 Amazon 卡在 Amazon 返 3%）。
-- 新建 / 编辑交易时，卡积分 = 支付金额 × 返点率；有对应进货平台的规则就用规则，否则用支付方式的默认返点率。
CREATE TABLE public.payment_method_store_rates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  payment_method_id uuid NOT NULL,
  purchase_platform_id uuid NOT NULL,
  point_rate numeric(6,4) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.points_platforms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  display_name text NOT NULL,
  yen_conversion_rate numeric(10,4) DEFAULT 1.0 NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.purchase_platforms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  name text NOT NULL,
  is_builtin boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.return_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  quantity_returned integer NOT NULL,
  return_date date DEFAULT CURRENT_DATE NOT NULL,
  return_amount numeric(10,2) DEFAULT 0,
  points_deducted numeric(10,2) DEFAULT 0,
  loss_amount numeric(10,2) DEFAULT 0 NOT NULL,
  return_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sale_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  sale_date date DEFAULT CURRENT_DATE NOT NULL,
  selling_platform_id uuid,
  sale_order_number text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sales_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  quantity_sold integer NOT NULL,
  selling_price_per_unit numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) DEFAULT 0,
  shipping_fee numeric(10,2) DEFAULT 0,
  sale_date date DEFAULT CURRENT_DATE NOT NULL,
  total_selling_price numeric(10,2) GENERATED ALWAYS AS (((quantity_sold)::numeric * selling_price_per_unit)) STORED,
  cash_profit numeric(10,2),
  total_profit numeric(10,2),
  roi numeric(10,2),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  selling_platform_id uuid,
  sale_order_number text,
  actual_cash_spent numeric(10,2),
  sale_group_id uuid
);

CREATE TABLE public.selling_platforms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  name text NOT NULL,
  is_builtin boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.supplies_costs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  category text NOT NULL,
  amount numeric(10,2) DEFAULT 0 NOT NULL,
  purchase_date date DEFAULT CURRENT_DATE NOT NULL,
  description text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.transaction_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL
);

CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  product_name text NOT NULL,
  status text DEFAULT 'in_stock'::text NOT NULL,
  purchase_price_total numeric(10,2) DEFAULT 0 NOT NULL,
  card_paid numeric(10,2) DEFAULT 0 NOT NULL,
  point_paid numeric(10,2) DEFAULT 0 NOT NULL,
  balance_paid numeric(10,2) DEFAULT 0 NOT NULL,
  card_id uuid,
  cash_profit numeric(10,2),
  roi numeric(10,2),
  expected_platform_points numeric(10,2) DEFAULT 0,
  expected_card_points numeric(10,2) DEFAULT 0,
  expected_payment_date date,
  image_url text,
  notes text,
  return_date date,
  return_amount numeric(10,2),
  return_notes text,
  points_deducted numeric(10,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  platform_points_platform_id uuid,
  card_points_platform_id uuid,
  extra_platform_points numeric(10,2) DEFAULT 0,
  extra_platform_points_platform_id uuid,
  total_profit numeric(10,2),
  quantity integer DEFAULT 1,
  quantity_sold integer DEFAULT 0,
  jan_code text,
  unit_price numeric(10,2),
  purchase_platform_id uuid,
  order_number text,
  shipping_fee numeric(10,2) DEFAULT 0 NOT NULL,
  quantity_returned integer DEFAULT 0,
  quantity_in_stock integer GENERATED ALWAYS AS (((quantity - quantity_sold) - quantity_returned)) STORED
);

CREATE TABLE public.user_line_links (
  user_id uuid NOT NULL,
  line_user_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  transactions_columns jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  theme_palette text,
  default_payment_method_id uuid
);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'user'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ============================================================
-- 2. 约束（主键 / 唯一 / CHECK / 外键）
-- ============================================================

ALTER TABLE public.coupon_usage_history ADD CONSTRAINT coupon_usage_history_pkey PRIMARY KEY (id);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);
ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_pkey PRIMARY KEY (id);
ALTER TABLE public.jan_thumbnail_cache ADD CONSTRAINT jan_thumbnail_cache_pkey PRIMARY KEY (jan);
ALTER TABLE public.jan_thumbnail_queue ADD CONSTRAINT jan_thumbnail_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.kaitorix_catalog ADD CONSTRAINT kaitorix_catalog_pkey PRIMARY KEY (jan);
ALTER TABLE public.kaitorix_open_api_usage ADD CONSTRAINT kaitorix_open_api_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.kaitorix_price_cache ADD CONSTRAINT kaitorix_price_cache_pkey PRIMARY KEY (id);
ALTER TABLE public.kaitorix_price_history ADD CONSTRAINT kaitorix_price_history_pkey PRIMARY KEY (jan, store, observed_at);
ALTER TABLE public.kaitorix_scrape_queue ADD CONSTRAINT kaitorix_scrape_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_method_store_rates ADD CONSTRAINT payment_method_store_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.points_platforms ADD CONSTRAINT points_platforms_pkey PRIMARY KEY (id);
ALTER TABLE public.purchase_platforms ADD CONSTRAINT purchase_platforms_pkey PRIMARY KEY (id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.return_records ADD CONSTRAINT return_records_pkey PRIMARY KEY (id);
ALTER TABLE public.sale_orders ADD CONSTRAINT sale_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_pkey PRIMARY KEY (id);
ALTER TABLE public.selling_platforms ADD CONSTRAINT selling_platforms_pkey PRIMARY KEY (id);
ALTER TABLE public.supplies_costs ADD CONSTRAINT supplies_costs_pkey PRIMARY KEY (id);
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_pkey PRIMARY KEY (id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_line_links ADD CONSTRAINT user_line_links_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE public.kaitorix_open_api_usage ADD CONSTRAINT kaitorix_open_api_usage_usage_date_key UNIQUE (usage_date);
ALTER TABLE public.kaitorix_price_cache ADD CONSTRAINT kaitorix_price_cache_jan_key UNIQUE (jan);
ALTER TABLE public.points_platforms ADD CONSTRAINT points_platforms_name_key UNIQUE (name);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);
ALTER TABLE public.user_line_links ADD CONSTRAINT user_line_links_line_user_id_key UNIQUE (line_user_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

ALTER TABLE public.coupons ADD CONSTRAINT coupons_cashback_type_check CHECK (((cashback_type IS NULL) OR (cashback_type = ANY (ARRAY['instant'::text, 'points'::text, 'next_month'::text]))));
ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text, 'point_multiply'::text, 'free_item'::text, 'bogo'::text, 'combo_deal'::text, 'cashback'::text])));
ALTER TABLE public.coupons ADD CONSTRAINT coupons_redemption_method_check CHECK ((redemption_method = ANY (ARRAY['barcode'::text, 'qr_code'::text, 'coupon_code'::text, 'automatic'::text, 'manual'::text])));
ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])));
ALTER TABLE public.jan_thumbnail_queue ADD CONSTRAINT jan_thumbnail_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.kaitorix_price_cache ADD CONSTRAINT kaitorix_price_cache_last_fetch_source_check CHECK ((last_fetch_source = ANY (ARRAY['scraper'::text, 'official'::text, 'cache'::text])));
ALTER TABLE public.kaitorix_scrape_queue ADD CONSTRAINT kaitorix_scrape_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_type_check CHECK ((type = ANY (ARRAY['card'::text, 'bank'::text, 'wallet'::text, 'other'::text])));
-- 卡号后 4 位（可选，只存 4 位数字，用来区分多张卡）
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_card_last4_check CHECK ((card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'));
ALTER TABLE public.payment_method_store_rates ADD CONSTRAINT payment_method_store_rates_unique UNIQUE (payment_method_id, purchase_platform_id);
ALTER TABLE public.payment_method_store_rates ADD CONSTRAINT payment_method_store_rates_point_rate_check CHECK ((point_rate >= 0));
ALTER TABLE public.payment_method_store_rates ADD CONSTRAINT payment_method_store_rates_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE CASCADE;
ALTER TABLE public.payment_method_store_rates ADD CONSTRAINT payment_method_store_rates_purchase_platform_id_fkey FOREIGN KEY (purchase_platform_id) REFERENCES public.purchase_platforms(id) ON DELETE CASCADE;
ALTER TABLE public.return_records ADD CONSTRAINT return_records_quantity_returned_check CHECK ((quantity_returned > 0));
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_platform_fee_check CHECK ((platform_fee >= (0)::numeric));
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_quantity_sold_check CHECK ((quantity_sold > 0));
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_selling_price_per_unit_check CHECK ((selling_price_per_unit >= (0)::numeric));
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_shipping_fee_check CHECK ((shipping_fee >= (0)::numeric));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_check CHECK ((quantity > 0));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_returned_check CHECK ((quantity_returned >= 0));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_sold_check CHECK ((quantity_sold >= 0));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_stock'::text, 'awaiting_payment'::text, 'sold'::text, 'returned'::text])));
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])));

ALTER TABLE public.coupon_usage_history ADD CONSTRAINT coupon_usage_history_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;
ALTER TABLE public.coupon_usage_history ADD CONSTRAINT coupon_usage_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_card_points_platform_id_fkey FOREIGN KEY (card_points_platform_id) REFERENCES public.points_platforms(id);
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_platforms ADD CONSTRAINT purchase_platforms_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.return_records ADD CONSTRAINT return_records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;
ALTER TABLE public.return_records ADD CONSTRAINT return_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sale_orders ADD CONSTRAINT sale_orders_selling_platform_id_fkey FOREIGN KEY (selling_platform_id) REFERENCES public.selling_platforms(id);
ALTER TABLE public.sale_orders ADD CONSTRAINT sale_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_sale_group_id_fkey FOREIGN KEY (sale_group_id) REFERENCES public.sale_orders(id) ON DELETE SET NULL;
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_selling_platform_id_fkey FOREIGN KEY (selling_platform_id) REFERENCES public.selling_platforms(id);
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.selling_platforms ADD CONSTRAINT selling_platforms_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.supplies_costs ADD CONSTRAINT supplies_costs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.payment_methods(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_card_points_platform_id_fkey FOREIGN KEY (card_points_platform_id) REFERENCES public.points_platforms(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_extra_platform_points_platform_id_fkey FOREIGN KEY (extra_platform_points_platform_id) REFERENCES public.points_platforms(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_platform_points_platform_id_fkey FOREIGN KEY (platform_points_platform_id) REFERENCES public.points_platforms(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_purchase_platform_id_fkey FOREIGN KEY (purchase_platform_id) REFERENCES public.purchase_platforms(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- 默认卡：新建交易时自动选中；卡被删除时置空
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_default_payment_method_id_fkey FOREIGN KEY (default_payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;
ALTER TABLE public.user_line_links ADD CONSTRAINT user_line_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================
-- 3. 索引
-- ============================================================

CREATE INDEX idx_coupon_usage_history_coupon_id ON public.coupon_usage_history USING btree (coupon_id);
CREATE INDEX idx_coupon_usage_history_used_at ON public.coupon_usage_history USING btree (used_at);
CREATE INDEX idx_coupon_usage_history_user_id ON public.coupon_usage_history USING btree (user_id);
CREATE INDEX coupons_line_user_id_idx ON public.coupons USING btree (line_user_id);
CREATE INDEX idx_coupons_line_user_id ON public.coupons USING btree (line_user_id) WHERE (line_user_id IS NOT NULL);
CREATE INDEX idx_coupons_user_id ON public.coupons USING btree (user_id);
CREATE INDEX idx_coupons_wechat_openid ON public.coupons USING btree (wechat_openid) WHERE (wechat_openid IS NOT NULL);
CREATE INDEX idx_fixed_costs_user_id ON public.fixed_costs USING btree (user_id);
CREATE INDEX idx_jan_thumb_queue_jan ON public.jan_thumbnail_queue USING btree (jan);
CREATE INDEX idx_jan_thumb_queue_status ON public.jan_thumbnail_queue USING btree (status, created_at) WHERE (status = 'pending'::text);
CREATE INDEX idx_kaitorix_catalog_synced_at ON public.kaitorix_catalog USING btree (synced_at);
CREATE INDEX idx_kaitorix_open_api_usage_date ON public.kaitorix_open_api_usage USING btree (usage_date);
CREATE INDEX idx_price_cache_jan ON public.kaitorix_price_cache USING btree (jan);
CREATE INDEX idx_scrape_queue_jan ON public.kaitorix_scrape_queue USING btree (jan);
CREATE INDEX idx_scrape_queue_status ON public.kaitorix_scrape_queue USING btree (status, created_at);
CREATE INDEX notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX notifications_user_read ON public.notifications USING btree (user_id, read) WHERE (read = false);
CREATE INDEX idx_payment_methods_card_points_platform ON public.payment_methods USING btree (card_points_platform_id);
CREATE INDEX idx_payment_methods_user_id ON public.payment_methods USING btree (user_id);
CREATE INDEX idx_points_platforms_active ON public.points_platforms USING btree (is_active);
CREATE INDEX idx_points_platforms_name ON public.points_platforms USING btree (name);
CREATE INDEX idx_purchase_platforms_builtin ON public.purchase_platforms USING btree (is_builtin);
CREATE INDEX idx_purchase_platforms_user_id ON public.purchase_platforms USING btree (user_id);
CREATE INDEX idx_return_records_return_date ON public.return_records USING btree (return_date);
CREATE INDEX idx_return_records_transaction_id ON public.return_records USING btree (transaction_id);
CREATE INDEX idx_return_records_user_id ON public.return_records USING btree (user_id);
CREATE INDEX idx_sale_orders_sale_date ON public.sale_orders USING btree (sale_date);
CREATE INDEX idx_sale_orders_user_id ON public.sale_orders USING btree (user_id);
CREATE INDEX idx_sales_records_sale_date ON public.sales_records USING btree (sale_date);
CREATE INDEX idx_sales_records_sale_group_id ON public.sales_records USING btree (sale_group_id);
CREATE INDEX idx_sales_records_selling_platform ON public.sales_records USING btree (selling_platform_id);
CREATE INDEX idx_sales_records_transaction_id ON public.sales_records USING btree (transaction_id);
CREATE INDEX idx_sales_records_user_id ON public.sales_records USING btree (user_id);
CREATE INDEX idx_selling_platforms_builtin ON public.selling_platforms USING btree (is_builtin);
CREATE INDEX idx_selling_platforms_user_id ON public.selling_platforms USING btree (user_id);
CREATE INDEX idx_supplies_costs_purchase_date ON public.supplies_costs USING btree (purchase_date);
CREATE INDEX idx_supplies_costs_user_id ON public.supplies_costs USING btree (user_id);
CREATE INDEX idx_transaction_history_tx_id ON public.transaction_history USING btree (transaction_id, changed_at DESC);
CREATE INDEX idx_transactions_card_points_platform ON public.transactions USING btree (card_points_platform_id);
CREATE INDEX idx_transactions_extra_platform_points_platform ON public.transactions USING btree (extra_platform_points_platform_id);
CREATE INDEX idx_transactions_jan_code ON public.transactions USING btree (jan_code);
CREATE INDEX idx_transactions_platform_points_platform ON public.transactions USING btree (platform_points_platform_id);
CREATE INDEX idx_transactions_purchase_platform ON public.transactions USING btree (purchase_platform_id);
CREATE INDEX idx_transactions_quantity_in_stock ON public.transactions USING btree (quantity_in_stock);
CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


-- ============================================================
-- 4. 函数
-- ============================================================

-- 管理员判断（RLS 策略依赖）
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
  );
$function$;

-- INSERT 时自动写入当前用户
CREATE OR REPLACE FUNCTION public.set_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_kaitorix_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_points_platforms_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_purchase_platforms_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_return_records_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_selling_platforms_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 优惠券：usage_count 变化时自动维护 is_used（usage_limit = -1 表示无限次）
CREATE OR REPLACE FUNCTION public.update_coupon_used_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.usage_limit = -1 THEN
    NEW.is_used := false;
  ELSIF NEW.usage_count >= NEW.usage_limit THEN
    NEW.is_used := true;
  ELSE
    NEW.is_used := false;
  END IF;

  RETURN NEW;
END;
$function$;

-- 销售记录变动后，从 sales_records 直接汇总 quantity_sold（避免读到陈旧值）
CREATE OR REPLACE FUNCTION public.update_transaction_quantity_sold()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE transactions
  SET quantity_sold = (
    SELECT COALESCE(SUM(quantity_sold), 0)
    FROM sales_records
    WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
  )
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 退货记录变动后，汇总 quantity_returned 并自动维护 returned / in_stock 状态
CREATE OR REPLACE FUNCTION public.update_transaction_quantity_returned()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  trans_id UUID;
  new_quantity_returned INTEGER;
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
  trans_status TEXT;
BEGIN
  trans_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT COALESCE(SUM(quantity_returned), 0) INTO new_quantity_returned
  FROM return_records
  WHERE transaction_id = trans_id;

  SELECT quantity, quantity_sold, status INTO trans_quantity, trans_quantity_sold, trans_status
  FROM transactions
  WHERE id = trans_id;

  IF new_quantity_returned > 0 AND (trans_quantity - trans_quantity_sold - new_quantity_returned) <= 0 THEN
    -- 剩余库存全部退回 -> returned
    UPDATE transactions
    SET quantity_returned = new_quantity_returned, status = 'returned'
    WHERE id = trans_id;
  ELSIF trans_status = 'returned' AND (trans_quantity - trans_quantity_sold - new_quantity_returned) > 0 THEN
    -- 退货记录被删除、库存恢复 -> 回到 in_stock
    UPDATE transactions
    SET quantity_returned = new_quantity_returned, status = 'in_stock'
    WHERE id = trans_id;
  ELSE
    UPDATE transactions
    SET quantity_returned = new_quantity_returned
    WHERE id = trans_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 销售记录变动后重算交易状态（直接从 sales_records 汇总，避免竞态）
CREATE OR REPLACE FUNCTION public.update_transaction_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  trans_quantity INTEGER;
  trans_quantity_sold INTEGER;
  trans_status TEXT;
BEGIN
  SELECT quantity, status INTO trans_quantity, trans_status
  FROM transactions
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  -- 不自动改动 pending / returned / sold（用户确认过的状态）
  IF trans_status IN ('pending', 'returned', 'sold') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(quantity_sold), 0) INTO trans_quantity_sold
  FROM sales_records
  WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id);

  IF trans_quantity_sold >= trans_quantity THEN
    -- 全部售出时设为 awaiting_payment（而非 sold），不降级已确认的 sold
    UPDATE transactions
    SET status = 'awaiting_payment'
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id)
      AND status != 'sold';
  ELSE
    UPDATE transactions
    SET status = 'in_stock'
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 交易编辑历史：只记录被追踪字段的 diff
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

-- Kaitorix 抓取队列：入队（同 JAN 去重）/ 原子出队 / 清理
CREATE OR REPLACE FUNCTION public.enqueue_kaitorix_scrape(p_jan text, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  SELECT id INTO existing_id
  FROM kaitorix_scrape_queue
  WHERE jan = p_jan AND status IN ('pending', 'processing')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO kaitorix_scrape_queue (jan, user_id, status)
  VALUES (p_jan, p_user_id, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dequeue_kaitorix_scrape()
 RETURNS TABLE(id uuid, jan text, user_id uuid, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  UPDATE kaitorix_scrape_queue
  SET status = 'processing', attempts = kaitorix_scrape_queue.attempts + 1
  WHERE kaitorix_scrape_queue.id = (
    SELECT q.id
    FROM kaitorix_scrape_queue q
    WHERE q.status = 'pending'
    ORDER BY q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    kaitorix_scrape_queue.id,
    kaitorix_scrape_queue.jan,
    kaitorix_scrape_queue.user_id,
    kaitorix_scrape_queue.attempts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_kaitorix_queue()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM kaitorix_scrape_queue
  WHERE status IN ('completed', 'failed')
    AND updated_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

-- 缩略图队列（JAN 维度，全站共享）：入队 / 批量入队 / 出队 / 清理
CREATE OR REPLACE FUNCTION public.enqueue_jan_thumbnail(p_jan text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  -- 已经有图就不入队
  IF EXISTS (SELECT 1 FROM jan_thumbnail_cache c WHERE c.jan = p_jan AND c.image_url IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO existing_id
    FROM jan_thumbnail_queue
   WHERE jan = p_jan AND status IN ('pending', 'processing')
   LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO jan_thumbnail_queue (jan, status)
  VALUES (p_jan, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.batch_enqueue_jan_thumbnails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO jan_thumbnail_queue (jan, status)
  SELECT DISTINCT t.jan_code, 'pending'
    FROM transactions t
   WHERE t.jan_code ~ '^\d{8,13}$'
     AND NOT EXISTS (
       SELECT 1 FROM jan_thumbnail_cache c
        WHERE c.jan = t.jan_code
          AND (c.image_url IS NOT NULL OR c.image_fetch_failed_count >= 5)
     )
     AND NOT EXISTS (
       SELECT 1 FROM jan_thumbnail_queue q
        WHERE q.jan = t.jan_code AND q.status IN ('pending', 'processing')
     );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dequeue_jan_thumbnail(p_limit integer DEFAULT 1)
 RETURNS TABLE(id uuid, jan text, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  UPDATE jan_thumbnail_queue q
     SET status = 'processing',
         attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT inner_q.id
       FROM jan_thumbnail_queue inner_q
      WHERE inner_q.status = 'pending'
         OR (inner_q.status = 'processing' AND inner_q.updated_at < now() - INTERVAL '2 minutes')
      ORDER BY inner_q.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
  RETURNING q.id, q.jan, q.attempts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_jan_thumbnail_queue()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM jan_thumbnail_queue
   WHERE status IN ('completed', 'failed')
     AND updated_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;


-- ============================================================
-- 5. 触发器
-- ============================================================

CREATE TRIGGER set_user_id_coupons BEFORE INSERT ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER trigger_update_coupon_used_status BEFORE UPDATE OF usage_count ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_coupon_used_status();
CREATE TRIGGER set_updated_at_jan_thumbnail_cache BEFORE UPDATE ON public.jan_thumbnail_cache FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_jan_thumbnail_queue BEFORE UPDATE ON public.jan_thumbnail_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_kaitorix_open_api_usage BEFORE UPDATE ON public.kaitorix_open_api_usage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kaitorix_price_cache_updated BEFORE UPDATE ON public.kaitorix_price_cache FOR EACH ROW EXECUTE FUNCTION public.update_kaitorix_updated_at();
CREATE TRIGGER trg_kaitorix_scrape_queue_updated BEFORE UPDATE ON public.kaitorix_scrape_queue FOR EACH ROW EXECUTE FUNCTION public.update_kaitorix_updated_at();
CREATE TRIGGER set_user_id_payment_method_store_rates BEFORE INSERT ON public.payment_method_store_rates FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_user_id_payment_methods BEFORE INSERT ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER update_points_platforms_updated_at BEFORE UPDATE ON public.points_platforms FOR EACH ROW EXECUTE FUNCTION public.update_points_platforms_updated_at();
CREATE TRIGGER update_purchase_platforms_updated_at BEFORE UPDATE ON public.purchase_platforms FOR EACH ROW EXECUTE FUNCTION public.update_purchase_platforms_updated_at();
CREATE TRIGGER trg_touch_profit_on_return AFTER INSERT OR DELETE OR UPDATE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_profit();
CREATE TRIGGER trigger_update_quantity_returned_on_delete AFTER DELETE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_quantity_returned();
CREATE TRIGGER trigger_update_quantity_returned_on_insert AFTER INSERT ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_quantity_returned();
CREATE TRIGGER trigger_update_quantity_returned_on_update AFTER UPDATE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_quantity_returned();
CREATE TRIGGER update_return_records_updated_at BEFORE UPDATE ON public.return_records FOR EACH ROW EXECUTE FUNCTION public.update_return_records_updated_at();
CREATE TRIGGER set_user_id_sale_orders BEFORE INSERT ON public.sale_orders FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER trg_calc_sale_profit BEFORE INSERT OR UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.calc_sale_profit();
CREATE TRIGGER trg_touch_profit_on_sale AFTER INSERT OR DELETE OR UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_profit();
CREATE TRIGGER trigger_update_quantity_sold_on_delete AFTER DELETE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_quantity_sold();
CREATE TRIGGER trigger_update_quantity_sold_on_insert AFTER INSERT ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_quantity_sold();
CREATE TRIGGER trigger_update_quantity_sold_on_update AFTER UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_quantity_sold();
CREATE TRIGGER trigger_update_status_on_sale AFTER INSERT OR DELETE OR UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.update_transaction_status();
CREATE TRIGGER update_selling_platforms_updated_at BEFORE UPDATE ON public.selling_platforms FOR EACH ROW EXECUTE FUNCTION public.update_selling_platforms_updated_at();
CREATE TRIGGER set_user_id_transactions BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER trg_calc_transaction_profit BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.calc_transaction_profit();
CREATE TRIGGER trg_recalc_sales_on_cost_change AFTER UPDATE OF purchase_price_total, quantity, expected_platform_points, expected_card_points, extra_platform_points ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.recalc_sales_on_cost_change();
CREATE TRIGGER trg_transaction_history AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.record_transaction_change();


-- ============================================================
-- 6. 视图
-- ============================================================

CREATE VIEW public.active_coupons WITH (security_invoker = true) AS
 SELECT id,
    name,
    discount_type,
    discount_value,
    min_purchase_amount,
    expiry_date,
    is_used,
    used_date,
    platform,
    notes,
    created_at,
    updated_at,
    user_id,
    start_date,
    coupon_code,
    max_discount_amount,
    target_item_name,
    target_item_value,
    usage_limit,
    usage_count,
    monthly_usage_cap,
    per_transaction_cap,
    time_restriction,
    day_of_week_restriction,
    recurring_dates,
    target_category,
    excluded_items,
    redemption_method,
    barcode_value,
    can_stack_with_other_coupons,
    can_stack_with_point_multiplier,
    can_stack_with_sale_price,
    requires_membership,
    membership_type,
    is_first_time_only,
    store_restriction,
    is_online_only,
    is_offline_only,
    combo_quantity,
    combo_price,
    cashback_timing,
    cashback_type,
    campaign_name,
    quantity_limit,
    quantity_used,
        CASE
            WHEN usage_limit = '-1'::integer THEN true
            WHEN usage_count < usage_limit THEN true
            ELSE false
        END AS can_use,
        CASE
            WHEN expiry_date < CURRENT_DATE THEN true
            ELSE false
        END AS is_expired,
    usage_limit - usage_count AS remaining_uses
   FROM public.coupons c
  WHERE user_id = auth.uid() AND (usage_limit = '-1'::integer OR usage_count < usage_limit) AND expiry_date >= CURRENT_DATE AND (quantity_limit IS NULL OR quantity_used < quantity_limit);

CREATE VIEW public.upcoming_payments WITH (security_invoker = true) AS
 SELECT pm.name AS payment_method_name,
    t.expected_payment_date,
    sum(t.purchase_price_total - COALESCE(t.point_paid, 0::numeric) - COALESCE(t.balance_paid, 0::numeric)) AS total_amount,
    count(t.id)::integer AS transaction_count,
    pm.id AS payment_method_id
   FROM public.transactions t
     JOIN public.payment_methods pm ON t.card_id = pm.id
  WHERE t.user_id = auth.uid() AND t.expected_payment_date IS NOT NULL AND t.expected_payment_date >= CURRENT_DATE AND t.status <> 'returned'::text
  GROUP BY pm.id, pm.name, t.expected_payment_date
  ORDER BY t.expected_payment_date;

CREATE VIEW public.sale_order_summary WITH (security_invoker = true) AS
 SELECT o.id AS sale_group_id,
    o.user_id,
    o.sale_date,
    o.selling_platform_id,
    o.sale_order_number,
    o.notes,
    o.created_at,
    count(s.id) AS item_count,
    COALESCE(sum(s.total_selling_price), 0::numeric) AS total_selling_price,
    COALESCE(sum(s.platform_fee + s.shipping_fee), 0::numeric) AS total_fees,
    COALESCE(sum(s.total_profit), 0::numeric) AS total_profit,
    COALESCE(sum(s.cash_profit), 0::numeric) AS total_cash_profit,
    COALESCE(sum(s.actual_cash_spent), 0::numeric) AS total_cash_spent
   FROM public.sale_orders o
     LEFT JOIN public.sales_records s ON s.sale_group_id = o.id
  GROUP BY o.id;

CREATE VIEW public.jan_thumbnail_queue_status WITH (security_invoker = true) AS
 SELECT status,
    count(*) AS count,
    min(created_at) AS oldest,
    max(updated_at) AS latest
   FROM public.jan_thumbnail_queue
  GROUP BY status
  ORDER BY status;

-- 视图不对未登录（anon）开放
REVOKE ALL ON public.sale_order_summary FROM anon;
REVOKE ALL ON public.jan_thumbnail_queue_status FROM anon;


-- ============================================================
-- 7. RLS 与策略
-- ============================================================

ALTER TABLE public.coupon_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jan_thumbnail_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jan_thumbnail_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kaitorix_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kaitorix_open_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kaitorix_price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kaitorix_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kaitorix_scrape_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_store_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selling_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_line_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- coupon_usage_history
CREATE POLICY "Users can insert own coupon usage history" ON public.coupon_usage_history FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own usage or admin sees all" ON public.coupon_usage_history FOR SELECT USING (((auth.uid() = user_id) OR (SELECT public.is_admin())));

-- coupons
CREATE POLICY "Users can delete own coupons or admin deletes all" ON public.coupons FOR DELETE USING ((((SELECT auth.uid()) = user_id) OR (SELECT public.is_admin())));
CREATE POLICY "Users can insert their own coupons" ON public.coupons FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own coupons or admin updates all" ON public.coupons FOR UPDATE USING ((((SELECT auth.uid()) = user_id) OR (SELECT public.is_admin())));
CREATE POLICY "Users can view own coupons or admin sees all" ON public.coupons FOR SELECT USING ((((SELECT auth.uid()) = user_id) OR (SELECT public.is_admin())));

-- fixed_costs
CREATE POLICY "Users can delete their own fixed costs" ON public.fixed_costs FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own fixed costs" ON public.fixed_costs FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own fixed costs" ON public.fixed_costs FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own fixed costs" ON public.fixed_costs FOR SELECT USING ((auth.uid() = user_id));

-- 缩略图 / 买取价缓存 / 买取商品目录 / 买取价历史：全站共享，登录用户只读（写入走 service_role）
CREATE POLICY jan_thumbnail_cache_select ON public.jan_thumbnail_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY jan_thumbnail_queue_select ON public.jan_thumbnail_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY kaitorix_catalog_select ON public.kaitorix_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY kaitorix_open_api_usage_select_admin ON public.kaitorix_open_api_usage FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY kaitorix_price_cache_select ON public.kaitorix_price_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY kaitorix_price_history_select ON public.kaitorix_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY kaitorix_scrape_queue_insert ON public.kaitorix_scrape_queue FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY kaitorix_scrape_queue_select ON public.kaitorix_scrape_queue FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- notifications / push_subscriptions
CREATE POLICY "Users read own notifications" ON public.notifications USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- payment_methods
CREATE POLICY "Users can delete their own payment methods" ON public.payment_methods FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own payment methods" ON public.payment_methods FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own payment methods" ON public.payment_methods FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own payment methods" ON public.payment_methods FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own store rates" ON public.payment_method_store_rates FOR DELETE TO authenticated USING ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can insert their own store rates" ON public.payment_method_store_rates FOR INSERT TO authenticated WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can update their own store rates" ON public.payment_method_store_rates FOR UPDATE TO authenticated USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can view their own store rates" ON public.payment_method_store_rates FOR SELECT TO authenticated USING ((user_id = (SELECT auth.uid())));

-- points_platforms
CREATE POLICY "Anyone can view points platforms" ON public.points_platforms FOR SELECT TO authenticated USING (true);

-- purchase_platforms
CREATE POLICY "Users can delete their own purchase platforms" ON public.purchase_platforms FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND (is_builtin = false)));
CREATE POLICY "Users can insert their own purchase platforms" ON public.purchase_platforms FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (is_builtin = false)));
CREATE POLICY "Users can update their own purchase platforms" ON public.purchase_platforms FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (is_builtin = false)));
CREATE POLICY "Users can view built-in and own purchase platforms" ON public.purchase_platforms FOR SELECT TO authenticated USING (((is_builtin = true) OR (user_id = auth.uid())));

-- return_records
CREATE POLICY "Users can delete their own return records" ON public.return_records FOR DELETE TO authenticated USING ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can insert their own return records" ON public.return_records FOR INSERT TO authenticated WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can update their own return records" ON public.return_records FOR UPDATE TO authenticated USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can view their own return records" ON public.return_records FOR SELECT TO authenticated USING ((user_id = (SELECT auth.uid())));

-- sale_orders
CREATE POLICY "Users can delete their own sale orders" ON public.sale_orders FOR DELETE TO authenticated USING ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can insert their own sale orders" ON public.sale_orders FOR INSERT TO authenticated WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can update their own sale orders" ON public.sale_orders FOR UPDATE TO authenticated USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can view their own sale orders" ON public.sale_orders FOR SELECT TO authenticated USING ((user_id = (SELECT auth.uid())));

-- sales_records
CREATE POLICY "Users can delete their own sales records" ON public.sales_records FOR DELETE TO authenticated USING ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can insert their own sales records" ON public.sales_records FOR INSERT TO authenticated WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can update their own sales records" ON public.sales_records FOR UPDATE TO authenticated USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
CREATE POLICY "Users can view their own sales records" ON public.sales_records FOR SELECT TO authenticated USING ((user_id = (SELECT auth.uid())));

-- selling_platforms
CREATE POLICY "Users can delete their own selling platforms" ON public.selling_platforms FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND (is_builtin = false)));
CREATE POLICY "Users can insert their own selling platforms" ON public.selling_platforms FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (is_builtin = false)));
CREATE POLICY "Users can update their own selling platforms" ON public.selling_platforms FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (is_builtin = false)));
CREATE POLICY "Users can view built-in and own selling platforms" ON public.selling_platforms FOR SELECT TO authenticated USING (((is_builtin = true) OR (user_id = auth.uid())));

-- supplies_costs
CREATE POLICY "Users can delete their own supplies costs" ON public.supplies_costs FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own supplies costs" ON public.supplies_costs FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own supplies costs" ON public.supplies_costs FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own supplies costs" ON public.supplies_costs FOR SELECT USING ((auth.uid() = user_id));

-- transaction_history
CREATE POLICY "users insert own history" ON public.transaction_history FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "users see own history" ON public.transaction_history FOR SELECT USING ((user_id = auth.uid()));

-- transactions
CREATE POLICY "Users can delete their own transactions" ON public.transactions FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING ((auth.uid() = user_id));

-- user_preferences
CREATE POLICY "user inserts own prefs" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "user reads own prefs" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "user updates own prefs" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id));

-- user_line_links：LINE 绑定由服务端（service_role，绕过 RLS）维护，客户端一律拒绝。
-- 显式写出拒绝策略，避免 linter 的 rls_enabled_no_policy 提示，也表明这是有意为之。
CREATE POLICY "No client access" ON public.user_line_links FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- user_roles（写入仅 service_role / SQL Editor）
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role = 'admin'::text)))));


-- ============================================================
-- 8. Storage（收据图片 + 商品缩略图）
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true), ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view receipt images" ON storage.objects FOR SELECT USING ((bucket_id = 'receipts'::text));
CREATE POLICY "Users can upload receipt images" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'receipts'::text));
CREATE POLICY "Users can update receipt images" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'receipts'::text)) WITH CHECK ((bucket_id = 'receipts'::text));
CREATE POLICY "Users can delete receipt images" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'receipts'::text));
-- product-images 的写入由 scraper 使用 service_role 完成
CREATE POLICY product_images_public_select ON storage.objects FOR SELECT USING ((bucket_id = 'product-images'::text));


-- ============================================================
-- 9. Realtime：通知页订阅 notifications
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;


-- ============================================================
-- 10. 基础数据（内置平台，非用户数据）
-- ============================================================

INSERT INTO public.points_platforms (name, display_name, yen_conversion_rate, description) VALUES
  ('amazon', 'Amazon ポイント', 1.0, 'Amazonポイント，1积分=1日元'),
  ('dpoint', 'd ポイント', 1.0, 'dポイント，1积分=1日元'),
  ('generic_card_1to1', '信用卡积分 (1:1)', 1.0, '通用信用卡积分，1积分=1日元'),
  ('paypay', 'PayPay ポイント', 1.0, 'PayPay积分，1积分=1日元'),
  ('ponta', 'Ponta ポイント', 1.0, 'Pontaポイント，1积分=1日元'),
  ('rakuten', '楽天ポイント', 1.0, '楽天积分，1积分=1日元'),
  ('vpoint', 'V ポイント', 1.0, '三井住友V Point，1积分=1日元');

INSERT INTO public.purchase_platforms (user_id, name, is_builtin) VALUES
  (NULL, 'Amazon', true),
  (NULL, 'Apple', true),
  (NULL, 'Yahoo!ショッピング', true),
  (NULL, 'ビックカメラ.com', true),
  (NULL, 'ヨドバシ.com', true),
  (NULL, '楽天市場', true),
  (NULL, 'その他', true);

INSERT INTO public.selling_platforms (user_id, name, is_builtin) VALUES
  (NULL, 'メルカリ', true),
  (NULL, '森森買取', true),
  (NULL, '買取一丁目', true),
  (NULL, '買取商店', true),
  (NULL, 'その他', true);
