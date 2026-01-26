// lib/financial/profit-calculator.ts
// 利润计算工具

import { calculateTotalPointsValue } from '@/lib/api/points-platforms';

/**
 * 计算交易的现金利润
 */
export function calculateCashProfit(
  sellingPrice: number,
  platformFee: number,
  shippingFee: number,
  purchasePrice: number
): number {
  return sellingPrice - platformFee - shippingFee - purchasePrice;
}

/**
 * 计算交易的总利润（包含积分价值）
 */
export async function calculateTotalProfit(params: {
  sellingPrice: number;
  platformFee: number;
  shippingFee: number;
  purchasePrice: number;
  platformPoints: number;
  platformPointsPlatformId: string | null;
  cardPoints: number;
  cardPointsPlatformId: string | null;
}): Promise<{
  cashProfit: number;
  pointsValue: number;
  totalProfit: number;
  platformPointsValue: number;
  cardPointsValue: number;
}> {
  const cashProfit = calculateCashProfit(
    params.sellingPrice,
    params.platformFee,
    params.shippingFee,
    params.purchasePrice
  );

  const pointsValueBreakdown = await calculateTotalPointsValue(
    params.platformPoints,
    params.platformPointsPlatformId,
    params.cardPoints,
    params.cardPointsPlatformId
  );

  return {
    cashProfit,
    pointsValue: pointsValueBreakdown.totalValue,
    totalProfit: cashProfit + pointsValueBreakdown.totalValue,
    platformPointsValue: pointsValueBreakdown.platformPointsValue,
    cardPointsValue: pointsValueBreakdown.cardPointsValue
  };
}

/**
 * 计算ROI（投资回报率）
 * @param totalProfit 总利润
 * @param purchasePrice 采购成本
 * @param pointPaid 积分抵扣金额
 * @returns ROI百分比
 */
export function calculateROI(totalProfit: number, purchasePrice: number, pointPaid: number = 0): number {
  const actualCashSpent = purchasePrice - pointPaid;
  if (actualCashSpent === 0) return 0;
  return (totalProfit / actualCashSpent) * 100;
}
