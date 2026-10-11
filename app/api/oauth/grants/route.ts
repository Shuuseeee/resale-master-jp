// app/api/oauth/grants/route.ts — 设置页「已连接的 AI」：列出当前用户授权过的客户端，撤销某个客户端的全部令牌
/* eslint-disable @typescript-eslint/no-explicit-any -- 关联查询的行按列名取值 */
import { getAuthedUser } from '@/lib/server/kaitorix-official';
import { serviceDb } from '@/lib/server/oauth';

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });
  const { data, error } = await serviceDb()
    .from('oauth_tokens')
    .select('client_id, kind, created_at, last_used_at, expires_at, revoked_at, client:oauth_clients(client_name, redirect_uris)')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const byClient = new Map<string, { client_id: string; client_name: string; redirect_host: string; connected_at: string; last_used_at: string | null }>();
  for (const t of (data ?? []) as any[]) {
    const host = (() => {
      try {
        return new URL(t.client?.redirect_uris?.[0] ?? '').host;
      } catch {
        return '';
      }
    })();
    const cur = byClient.get(t.client_id) ?? { client_id: t.client_id, client_name: t.client?.client_name ?? '未命名应用', redirect_host: host, connected_at: t.created_at, last_used_at: null };
    if (t.created_at < cur.connected_at) cur.connected_at = t.created_at;
    if (t.last_used_at && (!cur.last_used_at || t.last_used_at > cur.last_used_at)) cur.last_used_at = t.last_used_at;
    byClient.set(t.client_id, cur);
  }
  return Response.json([...byClient.values()].sort((a, b) => (b.last_used_at ?? b.connected_at).localeCompare(a.last_used_at ?? a.connected_at)));
}

export async function DELETE(req: Request) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });
  const clientId = new URL(req.url).searchParams.get('client_id');
  if (!clientId) return Response.json({ error: '缺少 client_id' }, { status: 400 });
  const { error } = await serviceDb()
    .from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .is('revoked_at', null);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
