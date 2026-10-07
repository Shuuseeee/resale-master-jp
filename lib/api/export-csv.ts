// lib/api/export-csv.ts
// 在库管理データをCSV形式でエクスポート

import { supabase } from '@/lib/supabase/client';
import { fetchAllByIds, fetchAllRows } from '@/lib/api/fetchAll';

/**
 * CSV列ヘッダー（purchases.csv形式に合わせる）
 */
const CSV_HEADERS = [
  '仕入日',
  '商品名',
  'JAN',
  '仕入単価',
  '数量',
  '仕入先',
  '注文ID',
  'アカウント',
  'ポイント使用',
  'クーポン',
  'P(サイト)',
  'P(カード)',
  'P(他)',
  '着荷',
  'メモ',
  '売却日',
  '売却先',
  '売却単価',
  '売却数量',
  '控除額',
  '売却注文ID',
  '売却メモ',
] as const;

/**
 * CSVセルをエスケープ（カンマ・改行・ダブルクォートを含む場合）
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * JAN码をCSV用にフォーマット（MayMoney互換：プレーンテキスト）
 */
function formatJAN(jan: string | null | undefined): string {
  if (!jan) return '';
  return escapeCSV(jan);
}

/**
 * データベースからトランザクション+販売記録を取得してCSV文字列を生成
 */
export async function exportTransactionsToCSV(transactionIds?: string[]): Promise<string> {
  // 1. トランザクション + 関連データを取得
  // 分页取全：PostgREST 单次响应有行数上限（默认 1000），超过的行会被静默截断——导出的 CSV 会悄悄少行。
  // 指定了 ID 时分块查询（.in() 会拼进请求地址，几百个 UUID 就超过网关上限）。
  const txSelect = `
      *,
      payment_method:payment_methods(name),
      purchase_platform:purchase_platforms(name)
    `;
  let transactions: any[];
  try {
    transactions =
      transactionIds && transactionIds.length > 0
        ? await fetchAllByIds<any>(transactionIds, (chunk, from, to, opts) =>
            supabase
              .from('transactions')
              .select(txSelect, opts)
              .in('id', chunk)
              .order('date', { ascending: true })
              .order('id')
              .range(from, to),
          )
        : await fetchAllRows<any>((from, to, opts) =>
            supabase
              .from('transactions')
              .select(txSelect, opts)
              .order('date', { ascending: true })
              .order('id')
              .range(from, to),
          );
  } catch (txError: any) {
    throw new Error(`取引データの取得に失敗: ${txError?.message ?? txError}`);
  }
  if (transactions.length === 0) throw new Error('エクスポートするデータがありません');
  // 分块读取后各块各自有序，合并后按「仕入日 → id」整体重排，保持与原先一致的输出顺序
  transactions.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  // 2. 全販売記録を一括取得（N+1回避）
  const txIds = transactions.map(t => t.id);
  let allSalesRecords: any[];
  try {
    allSalesRecords = await fetchAllByIds<any>(txIds, (chunk, from, to, opts) =>
      supabase
        .from('sales_records')
        .select(`
      *,
      selling_platform:selling_platforms(name)
    `, opts)
        .in('transaction_id', chunk)
        .order('sale_date', { ascending: true })
        .order('id')
        .range(from, to),
    );
  } catch (srError: any) {
    throw new Error(`販売記録の取得に失敗: ${srError?.message ?? srError}`);
  }

  // 販売記録をtransaction_idでグループ化
  const salesByTxId = new Map<string, any[]>();
  for (const sr of allSalesRecords || []) {
    const list = salesByTxId.get(sr.transaction_id) || [];
    list.push(sr);
    salesByTxId.set(sr.transaction_id, list);
  }

  // 3. CSV行を生成
  const rows: string[] = [];

  // BOM + ヘッダー行
  rows.push(CSV_HEADERS.join(','));

  for (const tx of transactions) {
    const salesRecords = salesByTxId.get(tx.id) || [];
    const purchasePlatformName = (tx.purchase_platform as any)?.name || '';
    const paymentMethodName = (tx.payment_method as any)?.name || '';

    // 仕入側の共通データ
    const purchaseCols = [
      escapeCSV(tx.date),                                    // 仕入日
      escapeCSV(tx.product_name),                            // 商品名
      formatJAN(tx.jan_code),                                // JAN
      escapeCSV(tx.unit_price ?? Math.round(tx.purchase_price_total / (tx.quantity || 1))), // 仕入単価
      escapeCSV(tx.quantity || 1),                           // 数量
      escapeCSV(purchasePlatformName),                       // 仕入先
      escapeCSV(tx.order_number),                            // 注文ID
      escapeCSV(paymentMethodName),                          // アカウント
      escapeCSV(tx.point_paid || 0),                         // ポイント使用
      escapeCSV(tx.balance_paid || 0),                       // クーポン（balance_paidで代用）
      escapeCSV(tx.expected_platform_points || 0),           // P(サイト)
      escapeCSV(tx.expected_card_points || 0),               // P(カード)
      escapeCSV(tx.extra_platform_points || 0),              // P(他)
      escapeCSV(tx.status === 'in_stock' ? '1' : ''),          // 着荷
      escapeCSV(tx.notes),                                   // メモ
    ];

    if (salesRecords.length === 0) {
      // 販売記録なし → 売却側は空
      rows.push([...purchaseCols, '', '', '', '', '', '', ''].join(','));
    } else {
      // 販売記録あり → 各レコードごとに1行
      for (let i = 0; i < salesRecords.length; i++) {
        const sr = salesRecords[i];
        const sellingPlatformName = (sr.selling_platform as any)?.name || '';
        const deduction = (sr.platform_fee || 0) + (sr.shipping_fee || 0);

        const saleCols = [
          escapeCSV(sr.sale_date),                           // 売却日
          escapeCSV(sellingPlatformName),                    // 売却先
          escapeCSV(sr.selling_price_per_unit),              // 売却単価
          escapeCSV(sr.quantity_sold),                       // 売却数量
          escapeCSV(deduction),                              // 控除額
          escapeCSV(sr.sale_order_number),                   // 売却注文ID
          escapeCSV(sr.notes),                               // 売却メモ
        ];

        if (i === 0) {
          // 最初の販売記録は仕入データと同じ行
          rows.push([...purchaseCols, ...saleCols].join(','));
        } else {
          // 2件目以降は仕入側を空にして売却データのみ
          const emptyCols = new Array(purchaseCols.length).fill('');
          rows.push([...emptyCols, ...saleCols].join(','));
        }
      }
    }
  }

  return '\uFEFF' + rows.join('\n');
}

/**
 * CSVをダウンロード
 */
export function downloadCSV(csvContent: string, filename?: string) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const defaultFilename = `purchases_${dateStr}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  link.click();
  URL.revokeObjectURL(url);
}
