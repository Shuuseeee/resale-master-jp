// types/database.types.ts
// Resale Master JP - TypeScript Type Definitions

export type PaymentMethodType = 'card' | 'bank' | 'wallet';
export type TransactionStatus = 'in_stock' | 'sold';
export type PointStatus = 'pending' | 'received' | 'expired';
export type BillingCycle = 'monthly' | 'yearly';
export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

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
  quantity_in_stock: number; // 库存数量（计算字段）

  // 成本端
  purchase_price_total: number;
  card_paid: number;
  point_paid: number;
  balance_paid: number;
  card_id: string | null;

  // 利润端（用于单品或整批销售）
  selling_price: number | null;
  platform_fee: number;
  shipping_fee: number;
  cash_profit: number | null; // 现金利润（不含积分价值）
  total_profit: number | null; // 总利润（现金利润 + 积分价值）
  roi: number | null;

  // 积分端
  expected_platform_points: number;
  expected_card_points: number;
  extra_platform_points: number; // 额外平台积分（用于叠加积分）
  point_status: PointStatus;
  platform_points_platform_id: string | null; // 购物平台积分的平台ID
  card_points_platform_id: string | null; // 信用卡积分的平台ID
  extra_platform_points_platform_id: string | null; // 额外平台积分的平台ID

  // 还款信息
  expected_payment_date: string | null;

  // 凭证
  image_url: string | null;

  // 备注
  notes: string | null;

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
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase_amount: number;
  expiry_date: string;
  is_used: boolean;
  used_date: string | null;
  platform: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  notes?: string;
}

export interface TransactionWithPaymentMethod extends Transaction {
  payment_method?: PaymentMethod;
}

// Database Response Types
export type DatabaseError = {
  message: string;
  details: string;
  hint: string;
  code: string;
};