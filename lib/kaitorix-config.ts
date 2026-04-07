// KaitoriX 買取価格チェック設定

export interface KaitorixStore {
  key: string;
  name: string;
}

// 旧版 key → 店铺名 映射，用于迁移旧 localStorage 配置
const LEGACY_KEY_TO_NAME: Record<string, string> = {
  'ichoume': '買取一丁目',
  'shouten': '買取商店',
  'morimori': '森森買取',
  'rudeya': '買取ルデヤ',
  'mobile_ichiban': 'モバイル一番',
  'homura': '買取ホムラ',
  'top_offers': '買取Top Offers',
  'rakuen': '買取楽園',
};

// 基础店铺（始终保留，即使尚未从 API 获取到数据）
// key 直接使用店铺名（新规）
const BASE_STORES: KaitorixStore[] = [
  { key: '買取一丁目', name: '買取一丁目' },
  { key: '買取商店', name: '買取商店' },
  { key: '森森買取', name: '森森買取' },
  { key: '買取ルデヤ', name: '買取ルデヤ' },
  { key: 'モバイル一番', name: 'モバイル一番' },
  { key: '買取ホムラ', name: '買取ホムラ' },
  { key: '買取Top Offers', name: '買取Top Offers' },
  { key: '買取楽園', name: '買取楽園' },
];

// 向后兼容：保留旧 ALL_STORES export（key 为旧格式），由 getKnownStores 取代
export const ALL_STORES: KaitorixStore[] = BASE_STORES;

export interface KaitorixConfig {
  enabled: boolean;
  enabledStores: string[]; // 现在存储店铺名（旧版存储 key，会自动迁移）
}

const STORAGE_KEY = 'kaitorix_config';
const DISCOVERED_STORES_KEY = 'kaitorix_discovered_stores';

// ── 动态店铺发现 ─────────────────────────────────────────────

/** 从 localStorage 读取已发现的店铺名列表，合并基础店铺后去重 */
export function getKnownStores(): KaitorixStore[] {
  const baseNames = new Set(BASE_STORES.map(s => s.name));
  const result = [...BASE_STORES];

  if (typeof window === 'undefined') return result;

  try {
    const stored = localStorage.getItem(DISCOVERED_STORES_KEY);
    if (stored) {
      const names: string[] = JSON.parse(stored);
      names.forEach(name => {
        if (!baseNames.has(name)) {
          result.push({ key: name, name });
          baseNames.add(name);
        }
      });
    }
  } catch {}

  return result;
}

/** 将新发现的店铺名保存到 localStorage（API 响应时调用） */
export function discoverStores(storeNames: string[]): void {
  if (typeof window === 'undefined') return;

  const known = getKnownStores();
  const knownNames = new Set(known.map(s => s.name));
  const hasNew = storeNames.some(n => !knownNames.has(n));
  if (!hasNew) return;

  try {
    const stored = localStorage.getItem(DISCOVERED_STORES_KEY);
    const existing: string[] = stored ? JSON.parse(stored) : [];
    const merged = Array.from(new Set([...existing, ...storeNames]));
    localStorage.setItem(DISCOVERED_STORES_KEY, JSON.stringify(merged));
  } catch {}
}

// ── 配置读写 ──────────────────────────────────────────────────

export function loadKaitorixConfig(): KaitorixConfig {
  if (typeof window === 'undefined') {
    return { enabled: true, enabledStores: BASE_STORES.map(s => s.key) };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // 首次使用：默认启用所有已知店铺
      return { enabled: true, enabledStores: getKnownStores().map(s => s.key) };
    }

    const parsed = JSON.parse(stored);
    const enabledStores: string[] = Array.isArray(parsed.enabledStores)
      ? parsed.enabledStores
      : getKnownStores().map(s => s.key);

    // 旧版迁移：将旧 key 格式（ichoume 等）转为店铺名
    const migrated = enabledStores.map(k => LEGACY_KEY_TO_NAME[k] ?? k);

    return {
      enabled: parsed.enabled ?? true,
      enabledStores: migrated,
    };
  } catch {
    return { enabled: true, enabledStores: getKnownStores().map(s => s.key) };
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
