// app/.well-known/oauth-protected-resource/route.ts — MCP 授权规范要求的「受保护资源说明」（RFC 9728）
// 告诉 AI 客户端：本站的 MCP（/api/mcp/mcp）由本站自己的 OAuth 授权服务器授权（lib/server/oauth.ts）。
import { getPublicOrigin, metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { CORS_HEADERS, MCP_SCOPE } from '@/lib/server/oauth';

export function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json(
    { resource: origin, authorization_servers: [origin], scopes_supported: [MCP_SCOPE], bearer_methods_supported: ['header'] },
    { headers: CORS_HEADERS },
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
