// lib/financial/calculator.ts
// 财务计算工具函数库

/**
 * 积分折算率配置
 */
export const POINT_CONVERSION_RATES = {
  PAYPAY: 1.0,      // PayPay: 1积分 = 1日元
  RAKUTEN: 1.0,     // 楽天: 1积分 = 1日元
  TPOINT: 1.0,      // Tポイント: 1积分 = 1日元
  DPOINT: 1.0,      // dポイント: 1积分 = 1日元
  PONTA: 1.0,       // Pontaポイント: 1积分 = 1日元
  DEFAULT: 1.0,     // 默认折算率
} as const;

/**
 * 计算积分价值
 * @param points 积分数量
 * @param conversionRate 折算率
 * @returns 积分价值(日元)
 */
export function calculatePointsValue(
  points: number,
  conversionRate: number = POINT_CONVERSION_RATES.DEFAULT
): number {
  return points * conversionRate;
}

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
 * 计算总利润(包含积分价值)
 * @param sellingPrice 销售价格
 * @param platformFee 平台费用
 * @param shippingFee 运费
 * @param purchaseCost 采购成本
 * @param platformPoints 平台积分
 * @param cardPoints 信用卡积分
 * @param conversionRate 积分折算率
 * @param suppliesCost 耗材成本（可选）
 * @returns 总利润
 */
export function calculateTotalProfit(
  sellingPrice: number,
  platformFee: number = 0,
  shippingFee: number = 0,
  purchaseCost: number,
  platformPoints: number = 0,
  cardPoints: number = 0,
  conversionRate: number = POINT_CONVERSION_RATES.DEFAULT,
  suppliesCost: number = 0
): number {
  const cashProfit = calculateCashProfit(sellingPrice, platformFee, shippingFee, purchaseCost, suppliesCost);
  const pointsValue = calculatePointsValue(platformPoints + cardPoints, conversionRate);
  return cashProfit + pointsValue;
}

/**
 * 计算 ROI (投资回报率)
 * @param sellingPrice 销售价格
 * @param platformFee 平台费用
 * @param shippingFee 运费
 * @param purchaseCost 采购成本
 * @param platformPoints 平台积分
 * @param cardPoints 信用卡积分
 * @param conversionRate 积分折算率
 * @param pointPaid 积分抵扣金额（默认0）
 * @param suppliesCost 耗材成本（可选）
 * @returns ROI 百分比
 */
export function calculateROI(
  sellingPrice: number,
  platformFee: number = 0,
  shippingFee: number = 0,
  purchaseCost: number,
  platformPoints: number = 0,
  cardPoints: number = 0,
  conversionRate: number = POINT_CONVERSION_RATES.DEFAULT,
  pointPaid: number = 0,
  suppliesCost: number = 0
): number {
  // 计算实际现金支出（采购成本 + 耗材成本 - 积分抵扣）
  const actualCashSpent = purchaseCost + suppliesCost - pointPaid;
  if (actualCashSpent <= 0) return 0;

  const totalProfit = calculateTotalProfit(
    sellingPrice,
    platformFee,
    shippingFee,
    purchaseCost,
    platformPoints,
    cardPoints,
    conversionRate,
    suppliesCost
  );

  return (totalProfit / actualCashSpent) * 100;
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

/**
 * 计算积分过期日期
 * @param purchaseDate 购买日期
 * @param expiryDays 过期天数(默认90天)
 * @returns 过期日期
 */
export function calculatePointsExpiryDate(
  purchaseDate: Date | string,
  expiryDays: number = 90
): Date {
  const date = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
  const expiryDate = new Date(date);
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return expiryDate;
}