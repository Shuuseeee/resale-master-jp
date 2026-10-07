// lib/kaitorix-catalog-csv.ts
// 买取X「全部买取数据」CSV（BOM UTF-8）解析：
//   jan, name, category, msrp, <买取店名 × 38>, <店名>_取得日時 × 38
// 价格与取得日时按列名取（官方说明：列会增减，位置不保证）。纯函数模块。

export interface CatalogPrice {
  store: string;
  price: number;
  /** 该店报价的取得时间（ISO）；CSV 没给时省略 */
  updated_at?: string;
}

export interface CatalogRow {
  jan: string;
  name: string;
  category: string | null;
  msrp: number | null;
  prices: CatalogPrice[];
  max_price: number;
}

const TIME_SUFFIX = '_取得日時';
const BASE_COLUMNS = new Set(['jan', 'name', 'category', 'msrp']);

/** RFC 4180 CSV 解析：支持引号、引号内逗号 / 换行、"" 转义、CRLF / LF、BOM */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    // 跳过完全空白的行（文件末尾空行等）
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** "2026-08-23 21:54"（日本时间）→ ISO；无法解析返回 undefined */
export function parseJstDateTime(text: string | undefined): string | undefined {
  const m = text?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return undefined;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function toInt(text: string | undefined): number | null {
  if (!text) return null;
  const n = Number(text.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export interface ParsedCatalog {
  rows: CatalogRow[];
  stores: string[];
  /** 无法识别（JAN 非法 / 缺商品名）而跳过的行数 */
  skipped: number;
}

/** CSV 文本 → 商品目录行。JAN 重复时后出现的覆盖先出现的 */
export function parseCatalogCsv(text: string): ParsedCatalog {
  const table = parseCsv(text);
  if (table.length === 0) throw new Error('CSV 为空');

  const header = table[0].map(h => h.trim());
  const col = (name: string) => header.indexOf(name);
  const janIdx = col('jan');
  const nameIdx = col('name');
  if (janIdx < 0 || nameIdx < 0) throw new Error('CSV 缺少 jan / name 列，格式可能已变更');
  const categoryIdx = col('category');
  const msrpIdx = col('msrp');

  // 店铺列 = 非基础列且不以「_取得日時」结尾；对应的时间列按名字配对
  const stores = header
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name && !BASE_COLUMNS.has(name) && !name.endsWith(TIME_SUFFIX))
    .map(({ name, index }) => ({ name, priceIdx: index, timeIdx: col(name + TIME_SUFFIX) }));

  const byJan = new Map<string, CatalogRow>();
  let skipped = 0;

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const jan = (cells[janIdx] || '').replace(/\D/g, '');
    const name = (cells[nameIdx] || '').trim();
    if (!/^\d{7,14}$/.test(jan) || !name) { skipped++; continue; }

    const prices: CatalogPrice[] = [];
    for (const s of stores) {
      const price = toInt(cells[s.priceIdx]);
      if (price == null || price <= 0) continue;
      const updated_at = s.timeIdx >= 0 ? parseJstDateTime(cells[s.timeIdx]) : undefined;
      prices.push({ store: s.name, price, ...(updated_at ? { updated_at } : {}) });
    }

    byJan.set(jan, {
      jan,
      name,
      category: categoryIdx >= 0 ? (cells[categoryIdx] || '').trim() || null : null,
      msrp: msrpIdx >= 0 ? toInt(cells[msrpIdx]) : null,
      prices,
      max_price: prices.reduce((max, p) => Math.max(max, p.price), 0),
    });
  }

  return { rows: [...byJan.values()], stores: stores.map(s => s.name), skipped };
}
