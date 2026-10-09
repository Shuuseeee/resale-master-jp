// lib/utils/paymentMethods.ts
// 支付方式的展示工具：显示名（后 4 位、停用标注）、返点率与百分数的换算。

/**
 * 下拉 / 筛选里的显示名：「楽天カード ····4821」。
 * 停用的卡仍会被历史交易引用（编辑旧交易、按卡筛选历史），所以也要能看到，名称后标注「（已停用）」。
 */
export function paymentMethodDisplayName(pm: { name: string; is_active?: boolean | null; card_last4?: string | null }): string {
  const base = pm.card_last4 ? `${pm.name} ····${pm.card_last4}` : pm.name;
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
