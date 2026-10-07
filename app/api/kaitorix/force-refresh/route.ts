import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, refreshFromOfficial } from '@/lib/server/kaitorix-official';

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// 手动强制刷新：无视缓存新鲜度，直接调官方 Open API（额度是否用完由官方判定）
export async function POST(request: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return jsonError('请先登录后再使用官方强刷', 401);

  const body = await request.json().catch(() => null);
  const jan = typeof body?.jan === 'string' ? body.jan.trim() : '';
  if (!/^(\d{7,14}|B[A-Z0-9]{9})$/i.test(jan)) {
    return jsonError('JAN/ASIN 格式不正确', 400);
  }

  const result = await refreshFromOfficial(jan);
  if (!result.ok) {
    return jsonError(result.error, result.status, { rateLimit: result.rateLimit, tpsLimited: result.tpsLimited });
  }

  const { product, rateLimit } = result;
  return NextResponse.json({
    jan: product.jan,
    name: product.name,
    max_price: product.max_price,
    max_store: product.max_store,
    prices: product.prices,
    _source: 'official',
    _fetched_at: product.fetchedAt,
    rateLimit,
  });
}
