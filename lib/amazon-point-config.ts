// lib/amazon-point-config.ts
// Amazon ポイント自動計算の設定（保存在本机 localStorage）
//
// 只负责「网站给的积分」：Amazon 积分 + 活动、d 积分。
// 卡积分（支付返点）不在这里：由支付方式的返点率与店铺特殊规则计算（2026-10-09 起，原「信用卡返还」已移除）。

export interface AmazonPointConfig {
  amazon_point_rate: number;  // Amazon ポイント還元率 %
  campaign_rate: number;      // キャンペーン追加還元 %
  d_point_rate: number;       // d ポイント還元率 %
  d_point_cap: number;        // d ポイント上限 (¥)
  auto_calc_enabled: boolean; // 新規仕入れ時に自動計算
}

export const DEFAULT_AMAZON_CONFIG: AmazonPointConfig = {
  amazon_point_rate: 1,
  campaign_rate: 0,
  d_point_rate: 1,
  d_point_cap: 100,
  auto_calc_enabled: true,
};

const STORAGE_KEY = 'amazon_point_config';

function readStored(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function loadAmazonPointConfig(): AmazonPointConfig {
  const stored = readStored();
  if (!stored) return DEFAULT_AMAZON_CONFIG;
  // 旧版的 card_rate 不再读入（避免随保存写回）；迁移提示见 getLegacyAmazonCardRate
  const { card_rate: _legacyCardRate, ...rest } = stored;
  return { ...DEFAULT_AMAZON_CONFIG, ...rest } as AmazonPointConfig;
}

/** 旧版设置里的「信用卡返还」%（仍存在且 > 0 时返回），用于提示改成支付方式的店铺特殊规则 */
export function getLegacyAmazonCardRate(): number | null {
  const value = Number(readStored()?.card_rate);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** 用户确认已迁移后，从本机设置里删掉旧的 card_rate */
export function dismissLegacyAmazonCardRate(): void {
  const stored = readStored();
  if (!stored || !('card_rate' in stored)) return;
  const { card_rate: _removed, ...rest } = stored;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
}
