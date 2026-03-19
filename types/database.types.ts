// types/database.types.ts
// Resale Master JP - TypeScript Type Definitions

export type PaymentMethodType = 'card';
export type TransactionStatus = 'pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned';
export type BillingCycle = 'monthly' | 'yearly';
export type DiscountType =
  | 'percentage'      // 割引率 (10%OFF)
  | 'fixed_amount'    // 固定額 (500円引き)
  | 'point_multiply'  // ポイント倍率 (5倍)
  | 'free_item'       // 無料商品 (ファミチキ無料)
  | 'bogo'            // Buy One Get One (1個買うと1個無料)
  | 'combo_deal'      // コンボ (2個で300円)
  | 'cashback';       // 還元 (20%還元)

export type RedemptionMethod =
  | 'barcode'         // バーコード提示
  | 'qr_code'         // QRコード
  | 'coupon_code'     // クーポンコード入力
  | 'automatic'       // 自動適用
  | 'manual';         // 店員手動入力

export type CashbackType =
  | 'instant'         // 即時
  | 'points'          // ポイント付与
  | 'next_month';     // 翌月付与

// 购入平台接口
export interface PurchasePlatform {
  id: string;
  user_id: string | null; // null = 内置平台
  name: string;
  is_builtin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 出手平台接口
export interface SellingPlatform {
  id: string;
  user_id: string | null; // null = 内置平台
  name: string;
  is_builtin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 积分平台接口
export interface PointsPlatform {
  id: string;
  name: string;
  display_name: string;
  yen_conversion_rate: number; // 积分兑换日元的比率
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  closing_day: number | null;
  payment_day: number | null;
  payment_same_month: boolean; // true: 当月还款, false: 次月还款
  point_rate: number; // (已废弃) 使用card_points_platform_id代替
  card_points_platform_id: string | null; // 关联的积分平台ID
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  product_name: string;
  status: TransactionStatus;

  // 批量库存
  quantity: number; // 商品总数量
  quantity_sold: number; // 已售出数量
  quantity_returned: number; // 返品済数量
  quantity_in_stock: number; // 库存数量（计算字段: quantity - quantity_sold - quantity_returned）

  // 成本端
  purchase_price_total: number;
  card_paid: number;
  point_paid: number;
  balance_paid: number;
  card_id: string | null;

  // 利润端（由 sales_records 聚合 trigger 维护）
  cash_profit: number | null; // 现金利润（不含积分价值）
  total_profit: number | null; // 总利润（现金利润 + 积分价值）
  roi: number | null;

  // 积分端
  expected_platform_points: number;
  expected_card_points: number;
  extra_platform_points: number; // 额外平台积分（用于叠加积分）
  platform_points_platform_id: string | null; // 购物平台积分的平台ID
  card_points_platform_id: string | null; // 信用卡积分的平台ID
  extra_platform_points_platform_id: string | null; // 额外平台积分的平台ID

  // 还款信息
  expected_payment_date: string | null;

  // 购入平台信息
  jan_code: string | null;
  unit_price: number | null;
  purchase_platform_id: string | null;
  order_number: string | null;

  // 凭证
  image_url: string | null;

  // 备注
  notes: string | null;

  // 退货信息
  return_date?: string;
  return_amount?: number;
  return_notes?: string;
  points_deducted?: number;

  created_at: string;
  updated_at: string;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  billing_cycle: BillingCycle;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuppliesCost {
  id: string;
  user_id: string;
  category: string; // 包装材料、运输耗材、标签打印、其他
  amount: number;
  purchase_date: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuppliesCostFormData {
  category: string;
  amount: number;
  purchase_date: string;
  description?: string;
  notes?: string;
}

export interface Coupon {
  id: string;
  user_id: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase_amount: number;
  start_date: string | null;
  expiry_date: string;
  is_used: boolean;
  used_date: string | null;
  platform: string | null;
  coupon_code: string | null;
  max_discount_amount: number;
  notes: string | null;

  // Free item specific fields
  target_item_name: string | null;        // 対象商品名 (e.g., ファミチキ)
  target_item_value: number;              // 商品価値 (e.g., 180円相当)

  // Usage tracking
  usage_limit: number;                    // 使用回数制限 (1=1回限り, -1=無制限)
  usage_count: number;                    // 使用済み回数
  monthly_usage_cap: number | null;       // 月間上限額
  per_transaction_cap: number | null;     // 1回あたり上限額

  // Time restrictions
  time_restriction: string | null;        // 時間制限 (e.g., "11:00-15:00")
  day_of_week_restriction: string | null; // 曜日制限 (e.g., "月,水,金")
  recurring_dates: string | null;         // 定期開催日 (e.g., "20,30")

  // Category and item restrictions
  target_category: string | null;         // 対象カテゴリ
  excluded_items: string | null;          // 除外商品

  // Redemption
  redemption_method: RedemptionMethod;    // 引換方法
  barcode_value: string | null;           // バーコード番号

  // Stacking rules
  can_stack_with_other_coupons: boolean;      // 他クーポンと併用可能か
  can_stack_with_point_multiplier: boolean;   // ポイント倍率と併用可能か
  can_stack_with_sale_price: boolean;         // セール価格と併用可能か

  // Member/app requirements
  requires_membership: boolean;           // 会員限定か
  membership_type: string | null;         // 会員種別
  is_first_time_only: boolean;            // 初回限定か

  // Location restrictions
  store_restriction: string | null;       // 店舗制限
  is_online_only: boolean;                // オンライン限定
  is_offline_only: boolean;               // 店舗限定

  // Combo deal specific
  combo_quantity: number | null;          // コンボ数量
  combo_price: number | null;             // コンボ価格

  // Cashback specific
  cashback_timing: string | null;         // 還元時期
  cashback_type: CashbackType | null;     // 還元タイプ

  // Campaign tracking
  campaign_name: string | null;           // キャンペーン名
  quantity_limit: number | null;          // 数���限定
  quantity_used: number;                  // 使用済み数量

  created_at: string;
  updated_at: string;
}

// Coupon usage history
export interface CouponUsageHistory {
  id: string;
  coupon_id: string;
  user_id: string;
  used_at: string;
  discount_amount: number;
  transaction_amount: number;
  store_name: string | null;
  notes: string | null;
  created_at: string;
}

// Active coupon view (computed fields)
export interface ActiveCoupon extends Coupon {
  can_use: boolean;           // 使用可能か
  is_expired: boolean;        // 期限切れか
  remaining_uses: number;     // 残り使用回数
}

// Form Types
export interface TransactionFormData {
  date: string;
  product_name: string;
  quantity?: number; // 商品数量
  purchase_price_total: number;
  card_paid: number;
  point_paid: number;
  balance_paid: number;
  card_id: string;
  expected_platform_points: number;
  expected_card_points: number;
  extra_platform_points?: number; // 额外平台积分
  platform_points_platform_id?: string; // 购物平台积分平台ID
  card_points_platform_id?: string; // 信用卡积分平台ID
  extra_platform_points_platform_id?: string; // 额外平台积分平台ID
  jan_code?: string;
  unit_price?: number;
  purchase_platform_id?: string;
  order_number?: string;
  image_url?: string;
  notes?: string;
}

// 销售记录接口
export interface SalesRecord {
  id: string;
  transaction_id: string;
  user_id: string;
  quantity_sold: number;
  selling_price_per_unit: number;
  platform_fee: number;
  shipping_fee: number;
  sale_date: string;
  total_selling_price: number;
  cash_profit: number | null;
  total_profit: number | null;
  roi: number | null;
  actual_cash_spent: number | null;
  selling_platform_id: string | null;
  sale_order_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 销售记录表单数据
export interface SalesRecordFormData {
  quantity_sold: number;
  selling_price_per_unit: number;
  platform_fee: number;
  shipping_fee: number;
  sale_date: string;
  selling_platform_id?: string;
  sale_order_number?: string;
  notes?: string;
}

// 返品記録接口
export interface ReturnRecord {
  id: string;
  transaction_id: string;
  user_id: string;
  quantity_returned: number;
  return_date: string;
  return_amount: number;
  points_deducted: number;
  return_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 返品記録表单数据
export interface ReturnRecordFormData {
  quantity_returned: number;
  return_date: string;
  return_amount?: number;
  points_deducted?: number;
  return_reason?: string;
  notes?: string;
}

export interface TransactionWithPaymentMethod extends Transaction {
  payment_method?: PaymentMethod;
}

// KaitoriX 買取価格キャッシュ
export interface KaitorixCachedPrice {
  store: string;
  price: number;
  url: string;
  updated: string;
}

export interface KaitorixPriceCache {
  id: string;
  jan: string;
  product_name: string | null;
  max_price: number;
  max_store: string | null;
  prices: KaitorixCachedPrice[];
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export type ScrapeQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface KaitorixScrapeQueue {
  id: string;
  jan: string;
  user_id: string;
  status: ScrapeQueueStatus;
  attempts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Database Response Types
export type DatabaseError = {
  message: string;
  details: string;
  hint: string;
  code: string;
};