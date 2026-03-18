// lib/api/import-csv.ts
// purchases.csv形式のCSVをインポート

import { supabase } from '@/lib/supabase/client';

interface CSVRow {
  仕入日: string;
  商品名: string;
  JAN: string;
  仕入単価: string;
  数量: string;
  仕入先: string;
  注文ID: string;
  アカウント: string;
  ポイント使用: string;
  クーポン: string;
  'P(サイト)': string;
  'P(カード)': string;
  'P(他)': string;
  着荷: string;
  メモ: string;
  売却日: string;
  売却先: string;
  売却単価: string;
  売却数量: string;
  控除額: string;
  売却注文ID: string;
  売却メモ: string;
}

export interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
}

/**
 * 英文・中文の列名を日本語に正規化するマッピング
 * key: 英文/中文の列名, value: 日本語の列名
 */
const HEADER_ALIASES: Record<string, string> = {
  // 英文 → 日文
  'Purchase Date': '仕入日',
  'Product': '商品名',
  'Unit Price': '仕入単価',
  'Qty': '数量',
  'Source': '仕入先',
  'Order ID': '注文ID',
  'Account': 'アカウント',
  'Points Used': 'ポイント使用',
  'Coupon': 'クーポン',
  'Points (Site)': 'P(サイト)',
  'Points (Card)': 'P(カード)',
  'Points (Other)': 'P(他)',
  'Received': '着荷',
  'Memo': 'メモ',
  'Sale Date': '売却日',
  'Sold To': '売却先',
  'Sale Price': '売却単価',
  'Sale Qty': '売却数量',
  'Deduction': '控除額',
  'Sale Order ID': '売却注文ID',
  'Sale Memo': '売却メモ',
  // 中文 → 日文
  '进货日期': '仕入日',
  '进货单价': '仕入単価',
  '进货来源': '仕入先',
  '订单ID': '注文ID',
  '账号': 'アカウント',
  '使用积分': 'ポイント使用',
  '优惠券': 'クーポン',
  '积分(网站)': 'P(サイト)',
  '积分(信用卡)': 'P(カード)',
  '积分(其他)': 'P(他)',
  '到货': '着荷',
  '备注': 'メモ',
  '出售日期': '売却日',
  '出售对象': '売却先',
  '出售单价': '売却単価',
  '出售数量': '売却数量',
  '扣除额': '控除額',
  '出售订单ID': '売却注文ID',
  '出售备注': '売却メモ',
};

/**
 * 列名を日本語に正規化（日本語はそのまま、英文/中文はマッピング）
 */
function normalizeHeader(header: string): string {
  return HEADER_ALIASES[header] || header;
}

/**
 * CSVテキストをパースして行配列に変換
 */
function parseCSV(text: string): CSVRow[] {
  // BOM除去
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row as unknown as CSVRow);
  }

  return rows;
}

/**
 * CSV行をフィールド配列にパース（ダブルクォート対応）
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * JAN码のクリーニング（="xxx" 形式を除去）
 */
function cleanJAN(raw: string): string {
  return raw.replace(/^="?/, '').replace(/"?$/, '');
}

function parseNum(val: string): number {
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

interface PaymentMethodWithPlatform {
  id: string;
  name: string;
  card_points_platform_id: string | null;
}

interface PointsPlatform {
  id: string;
  display_name: string;
}

/**
 * 購入先と支払い方法から積分プラットフォームを推測
 */
function inferPointsPlatforms(
  platformName: string,
  cardId: string | null,
  extraPoints: number,
  paymentMethods: PaymentMethodWithPlatform[],
  pointsPlatforms: PointsPlatform[]
): {
  platformPointsPlatformId: string | null;
  cardPointsPlatformId: string | null;
  extraPointsPlatformId: string | null;
} {
  // カード積分プラットフォーム - 支払い方法から取得
  let cardPointsPlatformId: string | null = null;
  if (cardId) {
    const card = paymentMethods.find(pm => pm.id === cardId);
    cardPointsPlatformId = card?.card_points_platform_id || null;
  }

  // プラットフォーム積分 - 購入先から推測
  let platformPointsPlatformId: string | null = null;
  if (platformName) {
    const lowerName = platformName.toLowerCase();
    if (lowerName.includes('amazon')) {
      platformPointsPlatformId = pointsPlatforms.find(p =>
        p.display_name.includes('Amazon')
      )?.id || null;
    } else if (lowerName.includes('楽天') || lowerName.includes('rakuten')) {
      platformPointsPlatformId = pointsPlatforms.find(p =>
        p.display_name.includes('楽天')
      )?.id || null;
    } else if (lowerName.includes('yahoo')) {
      platformPointsPlatformId = pointsPlatforms.find(p =>
        p.display_name.includes('Yahoo')
      )?.id || null;
    }
  }

  // 追加積分 - dポイント
  let extraPointsPlatformId: string | null = null;
  if (extraPoints > 0) {
    extraPointsPlatformId = pointsPlatforms.find(p =>
      p.display_name.includes('d')
    )?.id || null;
  }

  return { platformPointsPlatformId, cardPointsPlatformId, extraPointsPlatformId };
}

/**
 * CSVファイルをインポート
 */
export async function importCSV(file: File): Promise<ImportResult> {
  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return { success: 0, skipped: 0, errors: ['CSVにデータ行がありません'] };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: 0, skipped: 0, errors: ['ログインが必要です'] };
  }

  // プラットフォーム名→IDのマッピングを取得
  const { data: purchasePlatforms } = await supabase
    .from('purchase_platforms')
    .select('id, name')
    .or(`is_builtin.eq.true,user_id.eq.${user.id}`);

  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('id, name, card_points_platform_id')
    .eq('user_id', user.id);

  // 積分プラットフォームを取得（推測用）
  const { data: pointsPlatforms } = await supabase
    .from('points_platforms')
    .select('id, display_name')
    .eq('is_active', true);

  const platformMap = new Map((purchasePlatforms || []).map(p => [p.name, p.id]));
  const paymentMap = new Map((paymentMethods || []).map(p => [p.name, p.id]));

  const result: ImportResult = { success: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // 1-indexed + header

    // 売却データのみの行（仕入日が空）はスキップ
    if (!row.仕入日 || !row.商品名) {
      result.skipped++;
      continue;
    }

    try {
      const quantity = parseNum(row.数量) || 1;
      const unitPrice = parseNum(row.仕入単価);
      const pointPaid = parseNum(row.ポイント使用);
      const balancePaid = parseNum(row.クーポン);
      const totalPrice = unitPrice * quantity;
      const cardPaid = totalPrice - pointPaid - balancePaid;

      const janCode = cleanJAN(row.JAN);
      const platformId = platformMap.get(row.仕入先) || null;
      const cardId = paymentMap.get(row.アカウント) || null;

      // 積分プラットフォームを推測
      const { platformPointsPlatformId, cardPointsPlatformId, extraPointsPlatformId } =
        inferPointsPlatforms(
          row.仕入先,
          cardId,
          parseNum(row['P(他)']),
          (paymentMethods as PaymentMethodWithPlatform[]) || [],
          (pointsPlatforms as PointsPlatform[]) || []
        );

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        date: row.仕入日,
        product_name: row.商品名,
        quantity,
        purchase_price_total: totalPrice,
        card_paid: Math.max(cardPaid, 0),
        point_paid: pointPaid,
        balance_paid: balancePaid,
        card_id: cardId,
        expected_platform_points: parseNum(row['P(サイト)']),
        expected_card_points: parseNum(row['P(カード)']),
        extra_platform_points: parseNum(row['P(他)']),
        platform_points_platform_id: platformPointsPlatformId,
        card_points_platform_id: cardPointsPlatformId,
        extra_platform_points_platform_id: extraPointsPlatformId,
        jan_code: janCode || null,
        unit_price: unitPrice || null,
        purchase_platform_id: platformId,
        order_number: row.注文ID || null,
        notes: row.メモ || null,
        status: row.着荷 === '1' ? 'in_stock' : 'pending',
      });

      if (error) {
        result.errors.push(`行${lineNum}: ${error.message}`);
      } else {
        result.success++;
      }
    } catch (e: any) {
      result.errors.push(`行${lineNum}: ${e.message}`);
    }
  }

  return result;
}
