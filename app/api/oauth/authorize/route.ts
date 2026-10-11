// app/api/oauth/authorize/route.ts — 授权端点：校验客户端、回调地址、PKCE 后存「待确认请求」，再送用户去 /auth/consent 登录确认
// 回调地址不合法时不能跳回去（防开放重定向），直接显示错误；其余错误按规范带 error 跳回客户端。
import { MCP_SCOPE, REQUEST_TTL_MS, getClient, purgeExpired, serviceDb } from '@/lib/server/oauth';

function back(redirectUri: string, params: Record<string, string | null>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return Response.redirect(u.toString(), 302);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const client = await getClient(q.get('client_id'));
  const redirectUri = q.get('redirect_uri') ?? client?.redirect_uris[0] ?? '';
  if (!client) return new Response('未知的客户端（client_id）', { status: 400 });
  if (!client.redirect_uris.includes(redirectUri)) return new Response('回调地址与注册时不一致（redirect_uri）', { status: 400 });

  const state = q.get('state');
  if (q.get('response_type') !== 'code') return back(redirectUri, { error: 'unsupported_response_type', state });
  const challenge = q.get('code_challenge');
  if (!challenge || q.get('code_challenge_method') !== 'S256') {
    return back(redirectUri, { error: 'invalid_request', error_description: '必须使用 PKCE（S256）', state });
  }

  await purgeExpired();
  const { data, error } = await serviceDb()
    .from('oauth_requests')
    .insert({
      client_id: client.id,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      scope: MCP_SCOPE,
      state,
      expires_at: new Date(Date.now() + REQUEST_TTL_MS).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) return back(redirectUri, { error: 'server_error', state });

  return Response.redirect(new URL(`/auth/consent?request_id=${data.id}`, req.url).toString(), 302);
}
