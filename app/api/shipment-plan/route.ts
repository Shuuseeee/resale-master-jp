// app/api/shipment-plan/route.ts — 网页比价弹层的「最优出货方案」
// 登录用户（cookie 会话）提交选中的进货与数量 → lib/server/mcp-tools.ts 的 planShipmentForSelection
// （与 MCP 的 plan_shipment 同一套：按用户重新查视图与商品尺寸，交给 /api/solver 求解，含运费、包邮条件、自检）。
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { planShipmentForSelection } from '@/lib/server/mcp-tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: toSet => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: '请先登录' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.items) ? body.items : [];
  const selections = raw
    .map(x => x as { transaction_id?: unknown; qty?: unknown })
    .filter(x => typeof x.transaction_id === 'string' && Number.isFinite(Number(x.qty)))
    .slice(0, 200)
    .map(x => ({ transactionId: x.transaction_id as string, qty: Number(x.qty) }));
  if (!selections.length) return NextResponse.json({ ok: false, error: '没有选中商品' }, { status: 400 });

  const excludeStores = Array.isArray(body?.exclude_stores) ? body.exclude_stores.filter((s: unknown) => typeof s === 'string') : [];
  try {
    const result = await planShipmentForSelection({ userId }, selections, { excludeStores });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '计算失败' }, { status: 500 });
  }
}
