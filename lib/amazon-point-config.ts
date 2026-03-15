// lib/amazon-point-config.ts
// Amazon ポイント自動計算の設定

export interface AmazonPointConfig {
  amazon_point_rate: number;  // Amazon ポイント還元率 %
  campaign_rate: number;      // キャンペーン追加還元 %
  card_rate: number;          // カード還元率 % (ポイント使用分除外)
  d_point_rate: number;       // d ポイント還元率 %
  d_point_cap: number;        // d ポイント上限 (¥)
  auto_calc_enabled: boolean; // 新規仕入れ時に自動計算
}

export const DEFAULT_AMAZON_CONFIG: AmazonPointConfig = {
  amazon_point_rate: 1,
  campaign_rate: 0,
  card_rate: 3,
  d_point_rate: 1,
  d_point_cap: 100,
  auto_calc_enabled: true,
};

export function loadAmazonPointConfig(): AmazonPointConfig {
  if (typeof window === 'undefined') return DEFAULT_AMAZON_CONFIG;
  const saved = localStorage.getItem('amazon_point_config');
  if (!saved) return DEFAULT_AMAZON_CONFIG;
  try {
    return { ...DEFAULT_AMAZON_CONFIG, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_AMAZON_CONFIG;
  }
}
