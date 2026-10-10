# Resale Master JP - 日本转卖业务财务管理系统

一个面向日本二手转卖业务的私用财务管理 PWA。系统覆盖采购、库存、销售、退货、积分、耗材、买取价对比和税务报表，适合在桌面浏览器和 iPhone 主屏幕 PWA 中使用。

## 核心功能

### 交易与库存
- **批量库存管理**：一笔采购可记录多个同款商品，支持分批销售、退货和在库统计。
- **混合支付录入**：支持信用卡、积分、余额拆分，并自动校验支付合计。
- **JAN 录入体验**：支持条形码扫描、商品名自动补全（查每日同步的买取X 全量目录，查不到再走 search API 兜底，少量重试应对网络抖动）、Kaitorix 买取价格缓存与对比；店铺报价更新超过 7 天不再作为参考。
- **离线只读**：交易列表的数据会按用户缓存到本机（IndexedDB），断网后仍可查看，顶部显示「离线中 · 更新于…」；离线时不能修改数据；登出会清空本机缓存。联网访问过的页面可离线打开（页面缓存保留 30 天），从主屏幕离线启动会进入交易列表。目前交易列表（含平台名）、仪表盘、耗材、数据分析（预设时间范围）、税务报表和买取价格页支持离线数据，设置页与各表单离线时只能打开外壳。
- **利润算法与买取X 一致**：利润由数据库触发器统一计算（网页与原生 App 同一口径），积分一律计入成本抵减，退货可填损失额，仪表盘 / 分析的确定利润扣除退货损失与经费。
- **导入导出（买取X 格式）**：交易页导出 CSV（当前列表）/ XLSX（全部数据：进货・出售・退货・经费），设置页导入买取X 导出的文件或模板；有一处错整份不导入，重复的进货自动跳过。
- **AI 分析数据导出**：交易详情页 / 列表多选可一键复制 JSON（交易 + 销售 + 退货 + 买取价缓存），结构与原生 App 一致，可直接贴给 AI 或 ResaleAssist 做分析。
- **图片凭证**：支持收据图片上传和 iPhone HEIC/HEIF 格式处理。
- **快速编辑**：列表页可快速编辑高频字段，完整付款拆分与凭证走完整编辑页。
- **状态标签**：交易列表默认显示「未售出」（未到货 + 库存中），并记住上次的选择；深链 `?tab=` 优先。搜索落空时提供「在全部交易中查找」。

### 财务与运营
- **支付方式管理**（设置页内）：信用卡与其他支付方式（PayPay、楽天ペイ、银行转账等，可一键添加常用项），配置返点率、卡号后 4 位、返点积分平台、默认支付方式和启用状态；**店铺特殊规则**可让同一支付方式在某个采购平台用不同返点率（如 Amazon 卡在 Amazon 返 3%），录入交易时自动套用。不管理还款周期。
- **积分平台系统**：维护积分平台汇率，并纳入 ROI / 总利润计算。
- **耗材成本**：记录包装材料、运输用品等成本，并纳入经营分析。

### 数据分析与税务
- **仪表盘**：展示库存数、总投资额、已回收、确认利润、未回收库存、预期积分 / 本月利润等核心经营指标。
- **数据分析**：按时间、平台、状态等维度查看业务表现。
- **税务申报**：提供日本报税语境下的交易与利润报表导出能力，支持 Excel/PDF/CSV 相关导出。

## 技术栈

- **框架**：Next.js 15 App Router + React 19 + TypeScript
- **样式**：Tailwind CSS + `app/globals.css` 里的 SNUtils 风格 CSS 变量
- **图标**：Fluent UI System Icons（`@fluentui/react-icons`，headless 版）
- **数据库与认证**：Supabase Auth + PostgreSQL + Storage
- **PWA**：Manifest + Workbox Service Worker
- **图表与导出**：Recharts、jsPDF、jspdf-autotable、XLSX
- **表格**：`@tanstack/react-table`（headless）
- **数据请求缓存**：`@tanstack/react-query`
- **Service Worker**：Workbox（`InjectManifest`，源码 `lib/sw/sw-source.ts`）
- **图片处理**：heic2any
- **买取价**：Kaitorix 官方 Open API（进入页面 / 手动刷新）+ 每日全量 CSV 同步（商品目录与价格历史）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`：

```bash
cp .env.local.example .env.local
```

最小必需配置：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

功能性配置：

```env
KAITORIX_API_TOKENS=your_token1,your_token2
KAITORIX_OPEN_API_KEY=your_open_api_key
KAITORIX_OPEN_API_DAILY_LIMIT=500   # 仅首次响应前的兜底；之后以官方响应头为准
CRON_SECRET=your_random_secret      # /api/kaitorix/catalog-sync 的 Cron 鉴权
```

买取价与目录同步依赖 Kaitorix 官方 Open API（Premium 每日 500 次，每秒 1 次）；每日 CSV 同步需要「全部买取数据」下载加购。使用范围与出处标注要求见官方文档 https://kaitorix.app/open/docs 。

### 3. 初始化数据库

在一个**全新**的 Supabase 项目里，打开 SQL Editor，执行 `supabase/schema.sql` 即可，一个文件建好所有表、视图、触发器、RLS、Storage bucket 和内置平台数据。

`supabase/migrations-archive/` 是历史增量记录，新装不需要执行。

注册第一个用户后，按 `schema.sql` 文件头的说明把它设为管理员。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

## 项目结构

```text
resale-master-jp/
├── app/
│   ├── layout.tsx                    # 根布局、主题初始化、PWA 注册
│   ├── manifest.ts                   # PWA Manifest
│   ├── globals.css                   # 设计 token 定义源和全局组件样式
│   ├── fluent-tokens.css             # Fluent / Loop 实测 token（浅色 / 深色）
│   ├── api/
│   │   ├── jan-product/[jan]/        # JAN 商品名补全（目录 → 缓存 → search API 兜底）
│   │   ├── kaitorix/                 # 买取价查询（[jan]）、强制刷新、Open API 用量、每日 CSV 同步（catalog-sync）
│   │   ├── thumbnail/enqueue/        # 商品缩略图抓取入队
│   ├── auth/                         # 登录、注册、OAuth 回调
│   ├── dashboard/                    # 仪表盘
│   ├── transactions/                 # 交易列表、新增、详情、编辑
│   ├── supplies/                     # 耗材成本管理
│   ├── analytics/                    # 数据分析
│   ├── tax-report/                   # 税务申报
│   └── settings/                     # 设置与支付方式管理
├── components/                       # 共用 React 组件
├── contexts/                         # AuthContext、PlatformsContext
├── hooks/                            # 自定义 hooks
├── lib/
│   ├── api/                          # 按业务域划分的 Supabase 调用
│   ├── financial/calculator.ts       # ROI 和利润计算
│   ├── supabase/client.ts            # Supabase SSR 客户端
│   ├── theme-mode.ts                 # 深浅色偏好（浅色 / 深色 / 跟随系统）
│   └── theme.ts                      # 共用 Tailwind class 片段
├── public/
│   ├── sw.js                         # Service Worker
│   ├── icons/                        # PWA 图标
│   └── fonts/                        # NotoSansJP（税务 PDF 导出用；界面用系统字体）
├── supabase/schema.sql               # 新装唯一入口（完整库结构）
├── supabase/migrations-archive/              # 历史增量记录（新装不需要）
├── scraper/                          # 独立服务：缩略图 worker；价格 scraper 仅为原生 App 保留
├── types/database.types.ts           # Supabase 类型定义
├── middleware.ts                     # 路由保护
└── tailwind.config.ts
```

## 数据库概览

### 主要表

- `transactions`：采购交易、库存数量、付款拆分、ROI、状态和编辑历史来源。
- `sale_orders`：销售订单，一个订单可含多件商品。
- `sales_records`：单笔或分批销售记录。
- `return_records`：退货记录。
- `payment_methods`：支付方式（类型 card / wallet / bank / other、返点率、可选卡号后 4 位）。
- `payment_method_store_rates`：支付方式的店铺特殊规则（支付方式 × 采购平台 → 返点率）。
- `coupons` / `coupon_usage_history`：优惠券与使用历史（web 端已移除优惠券功能，表保留供原生 App、LIFF / 小程序使用）。
- `supplies_costs` / `fixed_costs`：耗材与固定成本。
- `points_platforms` / `purchase_platforms` / `selling_platforms`：积分、采购、销售平台配置。
- `transaction_history`：交易字段变更历史。
- `notifications` / `push_subscriptions`：通知与推送订阅（web 端已移除通知功能，表保留供原生 App 使用）。
- `user_preferences`：用户级 UI 偏好，如交易列表列设置、默认支付方式（`theme_palette` 列仅原生 App 使用）。
- `user_roles`：管理员角色。
- `user_line_links`：用户与 LINE 账号绑定关系（web 端不使用）。
- `kaitorix_price_cache` / `kaitorix_open_api_usage`：单个 JAN 的买取价缓存、Open API 每日用量。
- `kaitorix_catalog`：每日同步的买取X 全量商品目录（约 2.6 万件，最新快照），用于输入 JAN 时补全商品名。
- `kaitorix_price_history`：买取价历史，每家店对每个 JAN 的报价**只在变动时**追加一行（`price` 为空表示不再报价）。
- `kaitorix_scrape_queue`：旧的价格抓取队列，web 已不再使用，仅原生 App 仍通过 `enqueue_kaitorix_scrape` 写入。
- `jan_thumbnail_cache` / `jan_thumbnail_queue`：JAN 维度共享的商品缩略图缓存与抓取队列。

### 视图与触发器

- `upcoming_payments`：30 天内待付款（web 已不使用，原生 App 仍在用）。
- `active_coupons`：当前可用优惠券（web 端已不使用）。
- `sale_order_summary`：销售订单汇总。
- `jan_thumbnail_queue_status`：缩略图队列状态监控。
- `set_user_id()`：插入时自动写入当前用户。
- `update_transaction_status()`：基于销售和退货记录重算交易状态与 ROI。
- `record_transaction_change()`：记录交易编辑历史。

所有核心业务表启用 RLS，按 `auth.uid()` 隔离用户数据。管理员读取权限通过 `user_roles` 与 `is_admin()` 放宽。

## 认证与 PWA

- Supabase Auth 支持邮箱密码、Google OAuth 和邀请用户注册。
- `middleware.ts` 保护业务页面，`/auth/*` 和 `/api/*` 为公开路径。
- PWA 使用 `app/manifest.ts` 和 `public/sw.js`，支持 iOS 添加到主屏幕。

## 开发命令

```bash
npm run dev          # 启动开发服务器，默认 localhost:3000
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run type-check   # TypeScript 类型检查
node scripts/scan-design-tokens.mjs  # 扫描设计 token 落实情况
```

项目当前没有 Jest / Vitest / Playwright 测试框架（`e2e/specs/` 是空目录占位）。目前没有内置的手动测试入口。

## 设计系统

- UI 以 Microsoft Loop（Fluent 2）为蓝本，只有品牌紫一套配色。所有颜色一律走 CSS 变量 token：数值来自 `app/fluent-tokens.css`（Loop 实测的 Fluent token 浅色 / 深色全量），`app/globals.css` 的语义 token（`--color-*` / `--label-*` / `--chart-1..8`）只引用它们。
- 深浅色支持浅色 / 深色 / 跟随系统：顶栏按钮快速切换，设置页「外观」可选跟随系统。
- `lib/theme.ts` 提供常用卡片、按钮、输入框、布局和提示样式。
- 图标统一使用 Fluent UI System Icons 的 headless 版本（按分组路径导入，如 `@fluentui/react-icons/headless/svg/home`），选中 / 悬停的实心态用 `components/fluent/DualIcon.tsx`；避免新增手写 SVG。
- 界面字体用 Loop 的系统字体栈（`--loop-font-text` / 标题 `--loop-font-display`，Segoe UI Variable → Apple / Android 系统字体），不加载网页字体。
- 外壳由 `components/Navigation.tsx` 组装：桌面（≥768）为透明顶栏 + 左导航（`components/shell/NavRail.tsx`，展开 / 折叠、「新建」菜单），手机为顶栏 + 底部标签栏。
- 交易列表（状态）、买取价格（视图）、税务申报（年度）、耗材管理（分类）、设置（分区）在桌面用左导航旁的分区抽屉切换（`components/shell/SectionDrawer.tsx`，页面用 `lib/section-drawer.ts` 的 `useSectionDrawer` 注册），手机仍在页面里切换。
- 桌面正文一律限宽 920（含左右内边距 1000）居中，表格放不下时在表格内横向滚动。
- 桌面每页顶部是 Loop 式文档头工具栏（`components/shell/PageHeader.tsx`：面包屑 + 操作按钮，放不下的收进「…」菜单），大标题用 `heading.page`，不写副标题；手机端标题区与按钮保持原样。
- `node scripts/scan-design-tokens.mjs` 扫描硬编码色值残留，无标记输出即全部落实。

## Scraper

`scraper/` 是独立 Node.js 项目，不属于 Next.js PWA 构建，包含两个 worker：

- **thumbnail-fetcher**：调 Kaitorix search API 获取商品缩略图并转存 Storage（写 `jan_thumbnail_cache`，不用 Playwright）。web 端在用。
- **kaitorix-scraper**：监听 `kaitorix_scrape_queue`，用 Playwright 抓价格写回 `kaitorix_price_cache`。**web 端已改走官方 Open API，不再入队**；它只为原生 App 保留（原生的价格自动刷新仍通过 `enqueue_kaitorix_scrape` 入队）。原生端迁到 web 接口之前不要停它。

详细启动方式见 `scraper/README.md`。

## 部署

- 推荐部署到 Vercel。
- 数据库和 Storage 使用 Supabase。
- 生产环境需要配置 `.env.local.example` 中列出的服务端和客户端变量。
- `scraper/` 不在 Vercel 上运行，需单独托管（pm2，见 `scraper/README.md`）。
