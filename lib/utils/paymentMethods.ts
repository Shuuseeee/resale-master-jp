// lib/utils/paymentMethods.ts
// 支付方式的展示名。停用的卡仍会被历史交易引用（编辑旧交易、按卡筛选历史），
// 所以下拉 / 筛选里要能看到它，用名称后的标注和启用中的卡区分开。

export function paymentMethodDisplayName(pm: { name: string; is_active?: boolean | null }): string {
  return pm.is_active === false ? `${pm.name}（已停用）` : pm.name;
}
