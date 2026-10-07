// lib/api/fetchAll.ts
// 分页读取整张表 / 整个结果集。
//
// 为什么需要：PostgREST 对单次响应有行数上限（Supabase 默认 1000），超过的部分会被**静默截断**，
// 既不报错也不提示——列表少几行、仪表盘求和偏小、CSV 导出缺行、报税数字不全。
//
// 判断「取完了没有」的方式不依赖我们对上限的假设：第一页带 count: 'exact' 拿到总行数，
// 之后按**实际返回的行数**推进偏移，直到收齐为止。因此即使项目把上限调成了小于页大小，
// 也不会提前停止。拿不到总数（count 为 null）时才退化为「返回不足一页即结束」。
//
// 调用方要求：
//  - select 的第二个参数必须传入 buildPage 收到的 selectOpts（第一页含 { count: 'exact' }）；
//  - 必须有**确定的排序且带唯一键兜底**（如 .order('date').order('id')），否则排序有并列时
//    不同页之间会出现重复 / 遗漏行。读取期间若有并发写入，偏移仍可能轻微漂移，属于可接受的取舍。

import type { PostgrestError } from '@supabase/supabase-js';

export interface PageResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
  count?: number | null;
}

export interface SelectOpts {
  count?: 'exact';
}

export const DEFAULT_PAGE_SIZE = 1000;
// 安全阀：防止异常情况下无限循环（1000 页 × 1000 行 = 100 万行，远超本应用的数据量）
const MAX_PAGES = 1000;

export async function fetchAllRows<T>(
  buildPage: (from: number, to: number, selectOpts: SelectOpts) => PromiseLike<PageResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let total: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = rows.length;
    const { data, error, count } = await buildPage(from, from + pageSize - 1, from === 0 ? { count: 'exact' } : {});
    if (error) throw error;
    if (page === 0) total = count ?? null;

    const batch = data ?? [];
    if (batch.length === 0) break;
    for (const row of batch) rows.push(row);

    if (total !== null ? rows.length >= total : batch.length < pageSize) break;
  }
  return rows;
}

// .in() 条件会拼进请求地址：565 个 UUID 约 20KB，超过网关限制就会失败，且随数据增长必坏。
// 分块后逐块（各自分页）读取。
export const DEFAULT_ID_CHUNK = 100;

export async function fetchAllByIds<T>(
  ids: readonly string[],
  buildPage: (idChunk: string[], from: number, to: number, selectOpts: SelectOpts) => PromiseLike<PageResult<T>>,
  chunkSize: number = DEFAULT_ID_CHUNK,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize) as string[];
    const rows = await fetchAllRows<T>((from, to, opts) => buildPage(chunk, from, to, opts), pageSize);
    for (const row of rows) out.push(row);
  }
  return out;
}
