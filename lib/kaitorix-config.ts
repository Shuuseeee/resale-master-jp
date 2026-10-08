// KaitoriX 買取価格チェック設定

/** 抓取时间超过此时长的 JAN，在进入页面 / 手动刷新时重新向官方 API 请求（只决定「要不要刷新」，不影响价格是否参考） */
export const KAITORIX_REFRESH_AFTER_MS = 30 * 60 * 1000; // 30 minutes

/** fetchedAt 为 undefined 或超过 30 分钟时返回 true */
export function needsKaitorixRefresh(fetchedAt: number | undefined): boolean {
  if (fetchedAt == null) return true;
  return Date.now() - fetchedAt > KAITORIX_REFRESH_AFTER_MS;
}

/** 店铺自己的报价更新时间超过此时长，该条报价不再作为参考（不参与最高价 / 利润计算） */
export const KAITORIX_REFERENCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  'top_offers': '買取Top Offer',
  'rakuen': '買取楽園',
};

// 店名别名 → 规范名。官方 API / CSV 的店名是「買取Top Offer」，旧爬虫写入的缓存和旧版配置是「買取Top Offers」，
// 实际是同一家店；读取缓存与配置时统一成官方写法，否则会被当成两家店（比价重复、店铺筛选漏掉一边）。
const STORE_NAME_ALIASES: Record<string, string> = {
  '買取Top Offers': '買取Top Offer',
};

export function normalizeStoreName(name: string): string {
  return STORE_NAME_ALIASES[name] ?? name;
}

/** 把报价列表里的店名统一成规范名（其余字段原样保留） */
export function normalizePriceStores<T extends { store: string }>(prices: T[] | null | undefined): T[] {
  if (!prices?.length) return [];
  return prices.map(p => {
    const store = normalizeStoreName(p.store);
    return store === p.store ? p : { ...p, store };
  });
}

// 基础店铺（始终保留，即使尚未从 API 获取到数据）
// key 直接使用店铺名（新规）
const BASE_STORES: KaitorixStore[] = [
  { key: '買取一丁目', name: '買取一丁目' },
  { key: '買取商店', name: '買取商店' },
  { key: '森森買取', name: '森森買取' },
  { key: '買取ルデヤ', name: '買取ルデヤ' },
  { key: 'モバイル一番', name: 'モバイル一番' },
  { key: '買取ホムラ', name: '買取ホムラ' },
  { key: '買取Top Offer', name: '買取Top Offer' },
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
      names.map(normalizeStoreName).forEach(name => {
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

  storeNames = storeNames.map(normalizeStoreName);
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
    const migrated = Array.from(new Set(enabledStores.map(k => normalizeStoreName(LEGACY_KEY_TO_NAME[k] ?? k))));

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
