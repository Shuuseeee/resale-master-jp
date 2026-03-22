// KaitoriX 買取価格チェック設定

export interface KaitorixStore {
  key: string;
  name: string;
}

export const ALL_STORES: KaitorixStore[] = [
  { key: 'ichoume', name: '買取一丁目' },
  { key: 'shouten', name: '買取商店' },
  { key: 'morimori', name: '森森買取' },
  { key: 'rudeya', name: '買取ルデヤ' },
  { key: 'mobile_ichiban', name: 'モバイル一番' },
  { key: 'homura', name: '買取ホムラ' },
  { key: 'top_offers', name: '買取Top Offers' },
  { key: 'rakuen', name: '買取楽園' },
];

export interface KaitorixConfig {
  enabled: boolean;
  enabledStores: string[]; // store keys
}

const STORAGE_KEY = 'kaitorix_config';

const DEFAULT_CONFIG: KaitorixConfig = {
  enabled: true,
  enabledStores: ALL_STORES.map(s => s.key), // all enabled by default
};

export function loadKaitorixConfig(): KaitorixConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;

    const parsed = JSON.parse(stored);
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      enabledStores: Array.isArray(parsed.enabledStores)
        ? parsed.enabledStores
        : DEFAULT_CONFIG.enabledStores,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveKaitorixConfig(config: KaitorixConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save KaitoriX config:', error);
  }
}
