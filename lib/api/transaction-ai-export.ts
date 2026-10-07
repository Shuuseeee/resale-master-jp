// lib/api/transaction-ai-export.ts
// 加载「AI 分析数据」所需的关联数据（销售 / 退货 / 买取价缓存），并产出 JSON 文本。
// 序列化结构见 lib/utils/transactionAIExport.ts。

import { supabase } from '@/lib/supabase/client';
import type { Transaction, SalesRecord, ReturnRecord } from '@/types/database.types';
import {
  buildBatchAIExport,
  buildTransactionAIExport,
  serializeAIExport,
  type AIExportKaitorixCache,
  type AIExportKaitorixPrice,
} from '@/lib/utils/transactionAIExport';

/** 列表与详情页的交易行都满足：Transaction + 可选的支付方式 / 采购平台关联 */
export type AIExportTransaction = Transaction & {
  payment_method?: { name?: string | null } | null;
  purchase_platform?: { name?: string | null } | null;
};

interface PlatformLike {
  id: string;
  name: string;
}

// .in() 条件会拼进 URL，分块避免超长（每个 UUID 36 字符）
const ID_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchByTransactionIds<T extends { transaction_id: string }>(
  table: 'sales_records' | 'return_records',
  orderColumn: 'sale_date' | 'return_date',
  ids: string[],
): Promise<Map<string, T[]>> {
  const map = new Map<string, T[]>();
  const results = await Promise.all(
    chunk(ids, ID_CHUNK).map(async part => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('transaction_id', part)
        // 与原生一致：新 → 旧
        .order(orderColumn, { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    }),
  );
  for (const row of results.flat()) {
    const list = map.get(row.transaction_id);
    if (list) list.push(row);
    else map.set(row.transaction_id, [row]);
  }
  return map;
}

async function fetchKaitorixCaches(jans: string[]): Promise<Map<string, AIExportKaitorixCache>> {
  const map = new Map<string, AIExportKaitorixCache>();
  const results = await Promise.all(
    chunk(jans, 200).map(async part => {
      const { data, error } = await supabase
        .from('kaitorix_price_cache')
        .select('jan, product_name, max_price, max_store, prices, fetched_at')
        .in('jan', part);
      if (error) throw error;
      return data ?? [];
    }),
  );
  for (const row of results.flat()) {
    map.set(row.jan, {
      jan: row.jan,
      product_name: row.product_name,
      max_price: row.max_price,
      max_store: row.max_store,
      fetched_at: row.fetched_at,
      prices: ((row.prices ?? []) as AIExportKaitorixPrice[]),
    });
  }
  return map;
}

/**
 * 生成 AI 分析 JSON 文本。
 * - single=true：单笔，输出 { transaction, sales, returns, kaitorix_prices? }
 * - 否则：多笔，输出 { transaction_count, transactions: [...] }，顺序与传入一致
 */
export async function buildAIExportJSON(
  transactions: AIExportTransaction[],
  opts: { purchasePlatforms: PlatformLike[]; sellingPlatforms: PlatformLike[]; single?: boolean },
): Promise<string> {
  const ids = transactions.map(t => t.id);
  const jans = [...new Set(transactions.map(t => t.jan_code).filter((j): j is string => !!j))];

  const [sales, returns, kaitorix] = await Promise.all([
    fetchByTransactionIds<SalesRecord>('sales_records', 'sale_date', ids),
    fetchByTransactionIds<ReturnRecord>('return_records', 'return_date', ids),
    fetchKaitorixCaches(jans),
  ]);

  const purchaseNames = new Map(opts.purchasePlatforms.map(p => [p.id, p.name]));
  const sellingNames = new Map(opts.sellingPlatforms.map(p => [p.id, p.name]));

  const items = transactions.map(t =>
    buildTransactionAIExport({
      transaction: t,
      purchasePlatformName:
        (t.purchase_platform_id ? purchaseNames.get(t.purchase_platform_id) : undefined) ??
        t.purchase_platform?.name,
      paymentMethodName: t.payment_method?.name,
      sales: sales.get(t.id) ?? [],
      sellingPlatformNames: sellingNames,
      returns: returns.get(t.id) ?? [],
      kaitorix: t.jan_code ? kaitorix.get(t.jan_code) : null,
    }),
  );

  return serializeAIExport(opts.single ? items[0] : buildBatchAIExport(items));
}
