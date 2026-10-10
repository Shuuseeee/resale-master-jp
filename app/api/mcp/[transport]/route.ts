// app/api/mcp/[transport]/route.ts — 自有 MCP 服务（Streamable HTTP），地址 https://<域名>/api/mcp/mcp
// 鉴权：OAuth 2.1（MCP 授权规范），授权服务器 = 本项目的 Supabase Auth（OAuth 2.1 Server）。
//   没带令牌 → 401 + WWW-Authenticate 指向 /.well-known/oauth-protected-resource → 客户端去 Supabase 登录授权（授权页 /auth/consent）
//   带令牌 → 向 Supabase Auth 校验并取得用户 → 工具用该用户的令牌查询（行级安全只给本人的数据）
// 三个工具：库存与利润概况、店铺规则、出货方案。实现见 lib/server/mcp-tools.ts。
import { createClient } from '@supabase/supabase-js';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { z } from 'zod';
import { inventoryOverview, planShipment, storeRules, type McpUser } from '@/lib/server/mcp-tools';

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });

function userOf(authInfo: AuthInfo | undefined): McpUser {
  const userId = authInfo?.extra?.userId;
  if (!authInfo || typeof userId !== 'string') throw new Error('未登录');
  return { token: authInfo.token, userId };
}

const handler = createMcpHandler(
  server => {
    server.registerTool(
      'inventory_overview',
      {
        title: '库存与利润概况',
        description:
          '我的二手转卖账本概况（与网页、买取X 同口径）：确定利润 = 销售利润 − 退货损失 − 经费；未售数量、库存成本、按当前最高买取价（7 天内报价）的预估利润。' +
          'include_items=true 时附每笔未售进货（单件成本、最高价与店铺、报价时间、预估利润、持有天数）。预估利润未扣运费，不能据此直接排出货方案，请用 plan_shipment。',
        inputSchema: { include_items: z.boolean().optional().describe('是否附上每笔未售进货，默认 true') },
      },
      async ({ include_items }, extra) => json(await inventoryOverview(userOf(extra.authInfo), include_items ?? true)),
    );

    server.registerTool(
      'store_rules',
      {
        title: '买取店规则',
        description:
          '各买取店的包邮条件、付款方式、额外条件、今天是否休业，以及规则的核实日期。maybe_outdated=true 表示超过 14 天未核实，应提醒我去官网确认后再出货。',
        inputSchema: {},
      },
      async () => json(await storeRules()),
    );

    server.registerTool(
      'plan_shipment',
      {
        title: '生成出货方案',
        description:
          '对未售库存做全局最优分销（整数规划，不是按单品最高价贪心）：综合各店报价（默认只用 7 天内的）、包邮条件、宅急便运费、箱型、手续费，' +
          '给出每家店发哪些商品、箱型、运费、净回款和利润，并附三方不等式自检与账目自检。没有有效报价的商品列在 unpriced（建议留库），' +
          '缺尺寸数据的列在 missing_meta（不参与），need_confirm 是规则未确认 / 被排除但报价更高的店（需要人工确认）。',
        inputSchema: {
          exclude_stores: z.array(z.string()).optional().describe('本次不考虑的店铺名'),
          keep_jans: z.array(z.string()).optional().describe('暂不出售（留库）的 JAN'),
          include_pending: z.boolean().optional().describe('是否把未到货的也算进去，默认 false'),
          stale_limit: z.number().int().min(1).max(30).optional().describe('报价有效天数，默认 7'),
        },
      },
      async ({ exclude_stores, keep_jans, include_pending, stale_limit }, extra) =>
        json(
          await planShipment(userOf(extra.authInfo), {
            excludeStores: exclude_stores,
            keepJans: keep_jans,
            includePending: include_pending,
            staleLimit: stale_limit,
          }),
        ),
    );
  },
  { serverInfo: { name: 'resale-master', version: '1.0.0' } },
  { basePath: '/api/mcp', maxDuration: 60, disableSse: true },
);

/** 校验 Supabase Auth（OAuth 2.1 Server）签发的访问令牌 */
async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data.user) return undefined;
  return { token: bearer, clientId: 'supabase', scopes: [], extra: { userId: data.user.id } };
}

const authed = withMcpAuth(handler, verifyToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
export const maxDuration = 60;
