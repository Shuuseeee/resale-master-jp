// types/database.types.ts
// Resale Master JP - TypeScript Type Definitions

export type PaymentMethodType = 'card' | 'bank' | 'wallet';
export type TransactionStatus = 'in_stock' | 'sold';
export type PointStatus = 'pending' | 'received' | 'expired';
export type BillingCycle = 'monthly' | 'yearly';
export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  closing_day: number | null;
  payment_day: number | null;
  payment_same_month: boolean; // true: 当月还款, false: 次月还款
  point_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  product_name: string;
  status: TransactionStatus;
  
  // 成本端
  purchase_price_total: number;
  card_paid: number;
  point_paid: number;
  balance_paid: number;
  card_id: string | null;
  
  // 利润端
  selling_price: number | null;
  platform_fee: number;
  shipping_fee: number;
  cash_profit: number | null;
  roi: number | null;
  
  // 积分端
  expected_platform_points: number;
  expected_card_points: number;
  point_status: PointStatus;
  
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
  purchase_price_total: number;
  card_paid: number;
  point_paid: number;
  balance_paid: number;
  card_id: string;
  expected_platform_points: number;
  expected_card_points: number;
  image_url?: string;
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