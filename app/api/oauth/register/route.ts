// app/api/oauth/register/route.ts — 动态客户端注册（RFC 7591）：AI 客户端自己登记，回调地址严格校验，同一 IP 限流
import { CORS_HEADERS, REGISTER_LIMIT_PER_HOUR, corsPreflight, oauthError, randomToken, redirectUriAllowed, serviceDb, sha256 } from '@/lib/server/oauth';

const AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return oauthError('invalid_client_metadata', '请求体不是 JSON');
  }
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === 'string') : [];
  if (!uris.length || uris.length > 10) return oauthError('invalid_redirect_uri', 'redirect_uris 必填（最多 10 个）');
  const bad = uris.find(u => !redirectUriAllowed(u));
  if (bad) return oauthError('invalid_redirect_uri', `不允许的回调地址：${bad}（只接受 https、本机回环 http 或反向域名的私有 scheme）`);
  const method = (body.token_endpoint_auth_method as string) ?? 'none';
  if (!(AUTH_METHODS as readonly string[]).includes(method)) return oauthError('invalid_client_metadata', '不支持的 token_endpoint_auth_method');
  const name = String(body.client_name ?? '').trim().slice(0, 100) || '未命名应用';

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const db = serviceDb();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from('oauth_clients').select('id', { count: 'exact', head: true }).eq('created_ip', ip).gte('created_at', since);
  if ((count ?? 0) >= REGISTER_LIMIT_PER_HOUR) return oauthError('too_many_requests', '注册过于频繁，请稍后再试', 429);

  const id = `cid_${randomToken(16)}`;
  const secret = method === 'none' ? null : randomToken();
  const { error } = await db.from('oauth_clients').insert({
    id,
    client_name: name,
    redirect_uris: uris,
    token_endpoint_auth_method: method,
    client_secret_hash: secret ? sha256(secret) : null,
    created_ip: ip,
  });
  if (error) return oauthError('server_error', error.message, 500);

  return Response.json(
    {
      client_id: id,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: method,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    { status: 201, headers: CORS_HEADERS },
  );
}

export const OPTIONS = corsPreflight;
