// app/api/oauth/requests/[id]/route.ts — 授权确认页（/auth/consent）用：读取待确认请求、提交允许 / 拒绝
// 必须是已登录用户（Supabase 会话 cookie）；允许后发一次性授权码，返回带 code / state 的回跳地址。
import { getAuthedUser } from '@/lib/server/kaitorix-official';
import { CODE_TTL_MS, randomToken, serviceDb, sha256 } from '@/lib/server/oauth';

async function load(id: string) {
  const { data } = await serviceDb()
    .from('oauth_requests')
    .select('id, client_id, redirect_uri, code_challenge, scope, state, expires_at, client:oauth_clients(client_name)')
    .eq('id', id)
    .maybeSingle();
  if (!data || Date.parse(data.expires_at) < Date.now()) return null;
  return data as unknown as {
    id: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    scope: string;
    state: string | null;
    client: { client_name: string } | null;
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });
  const r = await load((await params).id);
  if (!r) return Response.json({ error: '授权请求无效或已过期，请回到 AI 应用重新连接' }, { status: 404 });
  return Response.json({
    client_name: r.client?.client_name ?? '未命名应用',
    redirect_uri: r.redirect_uri,
    scope: r.scope,
    email: user.email,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });
  const id = (await params).id;
  const r = await load(id);
  if (!r) return Response.json({ error: '授权请求无效或已过期，请回到 AI 应用重新连接' }, { status: 404 });
  const { approve } = (await req.json()) as { approve?: boolean };
  const db = serviceDb();
  await db.from('oauth_requests').delete().eq('id', id);

  const target = new URL(r.redirect_uri);
  if (r.state) target.searchParams.set('state', r.state);
  if (!approve) {
    target.searchParams.set('error', 'access_denied');
    return Response.json({ redirect_url: target.toString() });
  }
  const code = randomToken();
  const { error } = await db.from('oauth_codes').insert({
    code_hash: sha256(code),
    client_id: r.client_id,
    user_id: user.id,
    redirect_uri: r.redirect_uri,
    code_challenge: r.code_challenge,
    scope: r.scope,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  target.searchParams.set('code', code);
  return Response.json({ redirect_url: target.toString() });
}
