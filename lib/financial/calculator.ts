// lib/financial/calculator.ts
// 财务计算工具函数库

/** 计算单件成本（扣除积分后的实际成本）。接受的字段在 TransactionForCompare / Transaction 上都有。 */
export function getUnitCost(t: {
  purchase_price_total: number;
  quantity: number;
  expected_platform_points?: number | null;
  expected_card_points?: number | null;
  extra_platform_points?: number | null;
}): number {
  const totalPoints = (t.expected_platform_points || 0) +
    (t.expected_card_points || 0) +
    (t.extra_platform_points || 0);
  return (t.purchase_price_total - totalPoints) / (t.quantity || 1);
}

/** 计算可用库存数量。接受的字段在 TransactionForCompare / Transaction 上都有。 */
export function getAvailableQty(t: {
  quantity_in_stock?: number | null;
  quantity: number;
  quantity_sold?: number | null;
  quantity_returned?: number | null;
}): number {
  return t.quantity_in_stock ?? Math.max(0, t.quantity - (t.quantity_sold || 0) - (t.quantity_returned || 0));
}

/**
 * 格式化金额
 * @param amount 金额
 * @param currency 货币符号
 * @returns 格式化后的金额字符串
 */
export function formatCurrency(amount: number | null | undefined, currency: string = '¥'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0`;
  }
  return `${currency}${amount.toLocaleString('ja-JP', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// 紧凑显示：超过1万用「万」，超过1億用「億」，适合卡片等空间有限场景
export function formatCurrencyCompact(amount: number | null | undefined, currency: string = '¥'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0`;
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 100_000_000) {
    const val = abs / 100_000_000;
    return `${sign}${currency}${val % 1 === 0 ? val : val.toFixed(1)}億`;
  }
  if (abs >= 10_000) {
    const val = abs / 10_000;
    return `${sign}${currency}${val % 1 === 0 ? val : val.toFixed(1)}万`;
  }
  return `${sign}${currency}${abs.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
}

/**
 * 格式化 ROI
 * @param roi ROI 百分比
 * @returns 格式化后的 ROI 字符串
 */
export function formatROI(roi: number | null | undefined): string {
  if (roi === null || roi === undefined || isNaN(roi)) {
    return '+0.00%';
  }
  const sign = roi >= 0 ? '+' : '';
  return `${sign}${roi.toFixed(2)}%`;
}
