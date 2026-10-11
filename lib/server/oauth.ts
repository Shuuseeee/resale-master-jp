// lib/server/oauth.ts — 自有 OAuth 2.1 授权服务器（给 MCP 用；设计参考 Trek，代码自写）
// 流程：客户端动态注册（RFC 7591）→ /api/oauth/authorize 校验后存「待确认请求」→ /auth/consent 登录并确认
//      → 发一次性授权码 → /api/oauth/token 用授权码 + PKCE 换访问令牌 / 刷新令牌（刷新令牌每次轮换）
// 令牌是随机串，只存 SHA-256；只对本应用的 MCP（只读工具）有效，拿不到 Supabase 的数据接口。
// 表：oauth_clients / oauth_requests / oauth_codes / oauth_tokens（只有 service role 能读写，见 supabase/schema.sql）
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const MCP_SCOPE = 'mcp';
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const REQUEST_TTL_MS = 10 * 60 * 1000;
/** 同一 IP 每小时最多注册的客户端数（防垃圾注册） */
export const REGISTER_LIMIT_PER_HOUR = 10;

export function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** PKCE S256：BASE64URL(SHA256(verifier)) === challenge */
export function pkceOk(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return safeEqual(createHash('sha256').update(verifier).digest('base64url'), challenge);
}

/**
 * 回调地址规则（同 Trek）：https；或本机回环 http（127.0.0.1 / localhost / [::1]，任意端口，供 Claude Code 等本地客户端）；
 * 或反向域名的私有 scheme（如 com.example.app:/callback）。不允许带 fragment。
 */
export function redirectUriAllowed(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:') return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  return /^[a-z][a-z0-9+.-]*\.[a-z0-9+.-]+:$/.test(u.protocol);
}

export interface OAuthClient {
  id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic';
  client_secret_hash: string | null;
}

export async function getClient(id: string | null | undefined): Promise<OAuthClient | null> {
  if (!id) return null;
  const { data } = await serviceDb().from('oauth_clients').select('*').eq('id', id).maybeSingle();
  return (data as OAuthClient | null) ?? null;
}

/** 令牌端点的客户端认证：公开客户端只靠 PKCE；机密客户端校验 client_secret（Basic 头或表单） */
export async function authenticateClient(req: Request, form: URLSearchParams): Promise<OAuthClient | null> {
  let id = form.get('client_id');
  let secret = form.get('client_secret');
  const basic = req.headers.get('authorization');
  if (basic?.startsWith('Basic ')) {
    const [u, p] = Buffer.from(basic.slice(6), 'base64').toString().split(':');
    id = decodeURIComponent(u ?? '');
    secret = decodeURIComponent(p ?? '');
  }
  const client = await getClient(id);
  if (!client) return null;
  if (client.token_endpoint_auth_method === 'none') return client;
  return secret && client.client_secret_hash && safeEqual(sha256(secret), client.client_secret_hash) ? client : null;
}

export async function issueTokens(clientId: string, userId: string, scope: string) {
  const db = serviceDb();
  const access = randomToken();
  const refresh = randomToken();
  const now = Date.now();
  const { error } = await db.from('oauth_tokens').insert([
    { token_hash: sha256(access), kind: 'access', client_id: clientId, user_id: userId, scope, expires_at: new Date(now + ACCESS_TTL_MS).toISOString() },
    { token_hash: sha256(refresh), kind: 'refresh', client_id: clientId, user_id: userId, scope, expires_at: new Date(now + REFRESH_TTL_MS).toISOString() },
  ]);
  if (error) throw error;
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh,
    scope,
  };
}

/** MCP 用：校验访问令牌，返回用户与客户端；顺带记录最近使用时间 */
export async function verifyAccessToken(token: string): Promise<{ userId: string; clientId: string; scope: string } | null> {
  const db = serviceDb();
  const hash = sha256(token);
  const { data } = await db
    .from('oauth_tokens')
    .select('user_id, client_id, scope, expires_at, revoked_at')
    .eq('token_hash', hash)
    .eq('kind', 'access')
    .maybeSingle();
  if (!data || data.revoked_at || Date.parse(data.expires_at) < Date.now()) return null;
  await db.from('oauth_tokens').update({ last_used_at: new Date().toISOString() }).eq('token_hash', hash);
  return { userId: data.user_id, clientId: data.client_id, scope: data.scope };
}

/** 顺手清理过期的待确认请求与授权码 */
export async function purgeExpired() {
  const db = serviceDb();
  const now = new Date().toISOString();
  await Promise.all([db.from('oauth_requests').delete().lt('expires_at', now), db.from('oauth_codes').delete().lt('expires_at', now)]);
}

/** OAuth 错误响应（RFC 6749 5.2） */
export function oauthError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: CORS_HEADERS });
}

/** 令牌 / 注册 / 撤销 / 元数据端点允许浏览器里的 MCP 客户端跨域调用（不带 cookie） */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
};

export const corsPreflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });
