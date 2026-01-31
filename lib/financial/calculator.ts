// lib/financial/calculator.ts
// 财务计算工具函数库

/**
 * 计算现金利润
 * @param sellingPrice 销售价格
 * @param platformFee 平台费用
 * @param shippingFee 运费
 * @param purchaseCost 采购成本
 * @param suppliesCost 耗材成本（可选）
 * @returns 现金利润
 */
export function calculateCashProfit(
  sellingPrice: number,
  platformFee: number = 0,
  shippingFee: number = 0,
  purchaseCost: number,
  suppliesCost: number = 0
): number {
  return sellingPrice - platformFee - shippingFee - purchaseCost - suppliesCost;
}

/**
 * 计算距离日期的天数
 * @param targetDate 目标日期
 * @returns 天数(负数表示已过期)
 */
export function daysUntil(targetDate: Date | string): number {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * 判断日期紧急程度
 * @param targetDate 目标日期
 * @returns 紧急程度: 'urgent' | 'warning' | 'normal' | 'expired'
 */
export function getUrgencyLevel(targetDate: Date | string): 'urgent' | 'warning' | 'normal' | 'expired' {
  const days = daysUntil(targetDate);

  if (days < 0) return 'expired';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'warning';
  return 'normal';
}

/**
 * 计算预计还款日期
 * @param transactionDate 交易日期
 * @param closingDay 账单日
 * @param paymentDay 还款日
 * @param paymentSameMonth 是否当月还款（true: 当月还款, false: 次月还款，默认false）
 * @returns 预计还款日期
 */
export function calculatePaymentDate(
  transactionDate: Date,
  closingDay: number,
  paymentDay: number,
  paymentSameMonth: boolean = false
): Date {
  const year = transactionDate.getFullYear();
  const month = transactionDate.getMonth();
  const day = transactionDate.getDate();

  // 计算本月账单日
  let closingDate = new Date(year, month, closingDay);

  // 如果交易日期在账单日之后,使用下个月的账单日
  if (day > closingDay) {
    closingDate = new Date(year, month + 1, closingDay);
  }

  // 根据配置决定还款月份
  let paymentMonth = closingDate.getMonth();
  if (!paymentSameMonth) {
    // 次月还款：账单日的下个月
    paymentMonth += 1;
  }
  // 当月还款：使用账单日所在月份

  const paymentDate = new Date(
    closingDate.getFullYear(),
    paymentMonth,
    paymentDay
  );

  return paymentDate;
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

/**
 * 计算财务安全水位线
 * @param totalBalance 总余额
 * @param upcomingPayments 即将到期的支付
 * @returns 安全水位百分比 (0-100)
 */
export function calculateWaterLevel(
  totalBalance: number,
  upcomingPayments: number
): number {
  if (totalBalance <= 0) return 0;
  if (upcomingPayments <= 0) return 100;
  
  const ratio = (totalBalance - upcomingPayments) / totalBalance;
  return Math.max(0, Math.min(100, ratio * 100));
}

/**
 * 获取水位线状态
 * @param waterLevel 水位百分比
 * @returns 状态: 'safe' | 'warning' | 'danger'
 */
export function getWaterLevelStatus(waterLevel: number): 'safe' | 'warning' | 'danger' {
  if (waterLevel >= 50) return 'safe';
  if (waterLevel >= 20) return 'warning';
  return 'danger';
}