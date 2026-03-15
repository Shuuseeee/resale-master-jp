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
 * CSVテキストをパースして行配列に変換
 */
function parseCSV(text: string): CSVRow[] {
  // BOM除去
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
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
    .select('id, name')
    .eq('user_id', user.id);

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
        jan_code: janCode || null,
        unit_price: unitPrice || null,
        purchase_platform_id: platformId,
        order_number: row.注文ID || null,
        notes: row.メモ || null,
        status: 'in_stock',
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
