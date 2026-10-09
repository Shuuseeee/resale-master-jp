// lib/utils/paymentMethods.ts
// 支付方式的展示工具：类型、显示名（后 4 位、类型、停用标注）、返点率与百分数的换算。

import type { PaymentMethodType } from '@/types/database.types';

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  card: '信用卡',
  wallet: '电子钱包・扫码支付',
  bank: '银行转账',
  other: '其他',
};

/** 下拉 / 列表排序：信用卡在前，其余按类型 */
const TYPE_ORDER: Record<string, number> = { card: 0, wallet: 1, bank: 2, other: 3 };
export function comparePaymentMethods(
  a: { type: string; name: string },
  b: { type: string; name: string },
): number {
  return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || a.name.localeCompare(b.name);
}

/** 常用的非信用卡支付方式（参考买取X），设置页可一键添加；返点率为预填值，添加前可改 */
export const PAYMENT_METHOD_PRESETS: Array<{ name: string; type: PaymentMethodType; percent: number }> = [
  { name: 'PayPay', type: 'wallet', percent: 0.5 },
  { name: '楽天ペイ', type: 'wallet', percent: 1 },
  { name: 'au PAY', type: 'wallet', percent: 0.5 },
  { name: 'd払い', type: 'wallet', percent: 0.5 },
  { name: 'メルペイ', type: 'wallet', percent: 0 },
  { name: 'Amazon Pay', type: 'wallet', percent: 0 },
  { name: '银行转账', type: 'bank', percent: 0 },
  { name: '便利店支付', type: 'other', percent: 0 },
  { name: '货到付款', type: 'other', percent: 0 },
  { name: '商品券・礼品卡', type: 'other', percent: 0 },
];

/**
 * 下拉 / 筛选里的显示名：信用卡「楽天カード ····4821」，其他支付方式「PayPay · 电子钱包・扫码支付」。
 * 停用的仍会被历史交易引用（编辑旧交易、按支付方式筛选历史），所以也要能看到，名称后标注「（已停用）」。
 */
export function paymentMethodDisplayName(pm: { name: string; type?: string | null; is_active?: boolean | null; card_last4?: string | null }): string {
  let base = pm.card_last4 ? `${pm.name} ····${pm.card_last4}` : pm.name;
  if (pm.type && pm.type !== 'card') {
    base += ` · ${PAYMENT_METHOD_TYPE_LABELS[pm.type as PaymentMethodType] ?? pm.type}`;
  }
  return pm.is_active === false ? `${base}（已停用）` : base;
}

/**
 * 返点率（库里存小数，0.07 = 7%）→ 百分数。先四舍五入到 0.01%，
 * 避免 0.07 * 100 = 7.000000000000001 这类浮点尾数出现在界面和输入框里。
 */
export function pointRateToPercent(rate: number | null | undefined): number {
  return Math.round((rate ?? 0) * 10000) / 100;
}

/** 百分数 → 返点率小数（7 → 0.07），同样消掉浮点尾数 */
export function percentToPointRate(percent: number): number {
  return Math.round(percent * 100) / 10000;
}

/** 显示用：「7%」「1.5%」「0%」 */
export function formatPointRate(rate: number | null | undefined): string {
  return `${pointRateToPercent(rate)}%`;
}

/**
 * 某支付方式在某采购平台的实际返点率：有店铺特殊规则用规则，否则用支付方式的默认返点率。
 * ruleApplied 用于在表单里提示「按店铺规则」。
 */
export function effectivePointRate(
  pm: { id: string; point_rate: number },
  purchasePlatformId: string | null | undefined,
  rules: ReadonlyArray<{ payment_method_id: string; purchase_platform_id: string; point_rate: number }>,
): { rate: number; ruleApplied: boolean } {
  const rule = purchasePlatformId
    ? rules.find(r => r.payment_method_id === pm.id && r.purchase_platform_id === purchasePlatformId)
    : undefined;
  return rule ? { rate: Number(rule.point_rate), ruleApplied: true } : { rate: pm.point_rate, ruleApplied: false };
}
