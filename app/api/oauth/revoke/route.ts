// app/api/oauth/revoke/route.ts — 令牌撤销（RFC 7009）：无论令牌是否存在都返回 200
import { authenticateClient, corsPreflight, CORS_HEADERS, oauthError, serviceDb, sha256 } from '@/lib/server/oauth';

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const client = await authenticateClient(req, form);
  if (!client) return oauthError('invalid_client', '客户端认证失败', 401);
  const token = form.get('token');
  if (token) {
    await serviceDb().from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('token_hash', sha256(token)).eq('client_id', client.id);
  }
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export const OPTIONS = corsPreflight;
