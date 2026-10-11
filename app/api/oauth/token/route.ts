// app/api/oauth/token/route.ts — 令牌端点：授权码 + PKCE 换令牌；刷新令牌换新令牌（旧刷新令牌作废，即轮换）
import { authenticateClient, corsPreflight, CORS_HEADERS, issueTokens, oauthError, pkceOk, serviceDb, sha256 } from '@/lib/server/oauth';

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const client = await authenticateClient(req, form);
  if (!client) return oauthError('invalid_client', '客户端认证失败', 401);
  const db = serviceDb();
  const grant = form.get('grant_type');

  if (grant === 'authorization_code') {
    const code = form.get('code') ?? '';
    const hash = sha256(code);
    const { data: row } = await db.from('oauth_codes').select('*').eq('code_hash', hash).maybeSingle();
    if (!row || row.client_id !== client.id || row.used_at || Date.parse(row.expires_at) < Date.now()) {
      return oauthError('invalid_grant', '授权码无效、已使用或已过期');
    }
    if (row.redirect_uri !== form.get('redirect_uri')) return oauthError('invalid_grant', 'redirect_uri 与授权时不一致');
    if (!pkceOk(form.get('code_verifier') ?? '', row.code_challenge)) return oauthError('invalid_grant', 'PKCE 校验失败');
    // 先标记已用再发令牌：同一授权码被并发重放时只有一次成功
    const { data: claimed } = await db.from('oauth_codes').update({ used_at: new Date().toISOString() }).eq('code_hash', hash).is('used_at', null).select('code_hash');
    if (!claimed?.length) return oauthError('invalid_grant', '授权码已使用');
    return Response.json(await issueTokens(client.id, row.user_id, row.scope), { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
  }

  if (grant === 'refresh_token') {
    const hash = sha256(form.get('refresh_token') ?? '');
    const { data: row } = await db.from('oauth_tokens').select('*').eq('token_hash', hash).eq('kind', 'refresh').maybeSingle();
    if (!row || row.client_id !== client.id || row.revoked_at || Date.parse(row.expires_at) < Date.now()) {
      return oauthError('invalid_grant', '刷新令牌无效或已过期');
    }
    const { data: revoked } = await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('token_hash', hash).is('revoked_at', null).select('token_hash');
    if (!revoked?.length) return oauthError('invalid_grant', '刷新令牌已使用');
    return Response.json(await issueTokens(client.id, row.user_id, row.scope), { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
  }

  return oauthError('unsupported_grant_type', '只支持 authorization_code 与 refresh_token');
}

export const OPTIONS = corsPreflight;
