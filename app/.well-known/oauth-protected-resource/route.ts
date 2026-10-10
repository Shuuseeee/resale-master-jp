// app/.well-known/oauth-protected-resource/route.ts — MCP 授权规范要求的「受保护资源说明」（RFC 9728）
// 告诉 AI 客户端：本站的 MCP（/api/mcp/mcp）由本项目的 Supabase Auth（OAuth 2.1 Server）授权。
import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';

const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
});

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
