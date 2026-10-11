// app/api/mcp/[transport]/route.ts — 自有 MCP 服务（Streamable HTTP），地址 https://<域名>/api/mcp/mcp
// 鉴权：OAuth 2.1（MCP 授权规范），授权服务器 = 本站自己的（lib/server/oauth.ts，设计参考 Trek）。
//   没带令牌 → 401 + WWW-Authenticate 指向 /.well-known/oauth-protected-resource → 客户端动态注册、去 /auth/consent 登录确认
//   带令牌 → 查 oauth_tokens 取得用户 → 工具按该用户读取（令牌只对本 MCP 有效，工具全部只读）
// 四个工具：库存与利润概况、交易明细查询、店铺规则、出货方案。实现见 lib/server/mcp-tools.ts。
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { inventoryOverview, planShipment, searchTransactions, storeRules, type McpUser } from '@/lib/server/mcp-tools';
import { MCP_SCOPE, verifyAccessToken } from '@/lib/server/oauth';
import { BRAND_ICONS } from '@/lib/brand-icons';

// 客户端（claude.ai 等）显示的名称与图标（MCP serverInfo.icons）。图标必须是绝对地址，用正式域名；本地开发时退回 localhost
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
const SERVER_INFO: Implementation = {
  name: 'resale-master',
  title: 'Resale Master',
  version: '1.0.0',
  description: '二手转卖账本：库存与利润概况、买取店规则、全局最优出货方案',
  websiteUrl: SITE,
  icons: [
    { src: `${SITE}${BRAND_ICONS.app192}`, mimeType: 'image/png', sizes: ['192x192'] },
    { src: `${SITE}${BRAND_ICONS.app512}`, mimeType: 'image/png', sizes: ['512x512'] },
  ],
};

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });

function userOf(authInfo: AuthInfo | undefined): McpUser {
  const userId = authInfo?.extra?.userId;
  if (!authInfo || typeof userId !== 'string') throw new Error('未登录');
  return { userId };
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
      'search_transactions',
      {
        title: '查询交易明细',
        description:
          '按 JAN / 商品名关键词 / 状态 / 进货日期查我的交易（含已售出），返回每笔进货的成本、积分、到货、确定利润与利润率，' +
          '以及每次出售（日期、渠道、单价、扣除、利润）、退货（退款、损失）和当前最高买取价（7 天内报价）。' +
          '用于复盘某个商品买卖得怎么样、对比不同进货来源或出售渠道。按进货日期从新到旧，最多 100 笔。',
        inputSchema: {
          jans: z.array(z.string()).optional().describe('JAN 列表'),
          keyword: z.string().optional().describe('商品名关键词（部分匹配）'),
          status: z.array(z.enum(['pending', 'in_stock', 'awaiting_payment', 'sold', 'returned'])).optional().describe('状态：pending 未到货 / in_stock 库存中 / awaiting_payment 待入账 / sold 已售出 / returned 已退货'),
          date_from: z.string().optional().describe('进货日期起（YYYY-MM-DD）'),
          date_to: z.string().optional().describe('进货日期止（YYYY-MM-DD）'),
          limit: z.number().int().min(1).max(100).optional().describe('最多返回几笔，默认 20'),
        },
      },
      async ({ jans, keyword, status, date_from, date_to, limit }, extra) =>
        json(await searchTransactions(userOf(extra.authInfo), { jans, keyword, status, dateFrom: date_from, dateTo: date_to, limit })),
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
  { serverInfo: SERVER_INFO },
  { basePath: '/api/mcp', maxDuration: 60, disableSse: true },
);

/** 校验本站 OAuth 服务器签发的访问令牌 */
async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const t = await verifyAccessToken(bearer);
  if (!t) return undefined;
  return { token: bearer, clientId: t.clientId, scopes: t.scope.split(' '), extra: { userId: t.userId } };
}

const authed = withMcpAuth(handler, verifyToken, { required: true, requiredScopes: [MCP_SCOPE] });

export { authed as GET, authed as POST, authed as DELETE };
export const maxDuration = 60;
