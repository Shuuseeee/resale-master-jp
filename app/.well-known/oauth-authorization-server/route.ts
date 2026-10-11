// app/.well-known/oauth-authorization-server/route.ts — 授权服务器元数据（RFC 8414），MCP 客户端据此找到注册 / 授权 / 令牌端点
import { getPublicOrigin } from 'mcp-handler';
import { CORS_HEADERS, MCP_SCOPE, corsPreflight } from '@/lib/server/oauth';

export function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      revocation_endpoint: `${origin}/api/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: [MCP_SCOPE],
    },
    { headers: CORS_HEADERS },
  );
}

export const OPTIONS = corsPreflight;
