# Resale Master JP - 日本转卖业务财务管理系统

一个面向日本二手转卖业务的私用财务管理 PWA。系统覆盖采购、库存、销售、退货、积分、优惠券、耗材、买取价对比、通知和税务报表，适合在桌面浏览器和 iPhone 主屏幕 PWA 中使用。

## 核心功能

### 交易与库存
- **批量库存管理**：一笔采购可记录多个同款商品，支持分批销售、退货和在库统计。
- **混合支付录入**：支持信用卡、积分、余额拆分，并自动校验支付合计。
- **JAN 录入体验**：支持条形码扫描、商品名自动补全、Kaitorix 买取价格缓存与对比；商品名为空时会持续重试补全，避免异步抓取时差导致漏填。
- **图片凭证**：支持收据图片上传和 iPhone HEIC/HEIF 格式处理。
- **快速编辑**：列表页可快速编辑高频字段，完整付款拆分与凭证走完整编辑页。

### 财务与运营
- **支付方式管理**：管理信用卡、银行账户和电子钱包，支持还款日与积分平台配置。
- **积分平台系统**：维护积分平台汇率，并纳入 ROI / 总利润计算。
- **优惠券管理**：支持优惠券有效期、使用状态、OCR 识别和通知提醒。
- **耗材成本**：记录包装材料、运输用品等成本，并纳入经营分析。
- **通知中心**：基于 Supabase Realtime、Web Push 和站内通知展示未读提醒。

### 数据分析与税务
- **仪表盘**：展示资金安全水位、待付款、待确认积分和核心经营指标。
- **数据分析**：按时间、平台、状态等维度查看业务表现。
- **税务申报**：提供日本报税语境下的交易与利润报表导出能力，支持 Excel/PDF/CSV 相关导出。

## 技术栈

- **框架**：Next.js 15 App Router + React 19 + TypeScript
- **样式**：Tailwind CSS + `app/globals.css` 里的 SNUtils 风格 CSS 变量
- **图标**：lucide-react
- **数据库与认证**：Supabase Auth + PostgreSQL + Storage + Realtime
- **PWA / 推送**：Manifest + Service Worker + Web Push (`web-push`)
- **图表与导出**：Recharts、jsPDF、jspdf-autotable、XLSX
- **图片处理**：heic2any
- **OCR**：Anthropic SDK，用于优惠券图片识别
- **买取价**：Kaitorix API + 独立 scraper 队列抓取

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
NEXT_PUBLIC_KAITORIX_RATE_LIMIT_MODE=ultra-safe
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
LINE_REMINDER_URL=https://...
```

### 3. 初始化数据库

在 Supabase Dashboard SQL Editor 或 Supabase CLI 中按顺序执行：

1. `supabase/migrations/00_initial_schema.sql` - 初始表、视图、触发器和基础数据
2. `supabase/migrations/05_fix_scraper_queue_atomic.sql` - Kaitorix 队列原子出队函数
3. `supabase/migrations/06_transaction_history.sql` - 交易编辑历史记录
4. `supabase/migrations/07_admin_role.sql` - 管理员角色系统
5. `supabase/migrations/08_seed_admin_users.sql` - 管理员用户种子数据
6. `supabase/migrations/09_user_preferences.sql` - 用户偏好配置，如交易列表列设置
7. `supabase/migrations/10_rls_user_line_links.sql` - LINE 绑定表 RLS 策略

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
│   ├── globals.css                   # SNUtils 风格主题变量和全局组件样式
│   ├── api/
│   │   ├── jan-product/[jan]/        # JAN 商品名查询与补全
│   │   ├── kaitorix/[jan]/           # 买取价格查询与 scrape 入队
│   │   ├── ocr/                      # 优惠券 OCR 与测试接口
│   │   └── push/                     # Web Push 订阅、测试、每日提醒
│   ├── auth/                         # 登录、注册、OAuth 回调
│   ├── dashboard/                    # 仪表盘
│   ├── transactions/                 # 交易列表、新增、详情、编辑
│   ├── coupons/                      # 优惠券管理
│   ├── supplies/                     # 耗材成本管理
│   ├── analytics/                    # 数据分析
│   ├── tax-report/                   # 税务申报
│   ├── notifications/                # 通知中心
│   └── settings/                     # 设置与支付方式管理
├── components/                       # 共用 React 组件
├── contexts/                         # AuthContext、PlatformsContext
├── hooks/                            # 自定义 hooks
├── lib/
│   ├── api/                          # 按业务域划分的 Supabase 调用
│   ├── financial/calculator.ts       # ROI 和利润计算
│   ├── supabase/client.ts            # Supabase SSR 客户端
│   └── theme.ts                      # 共用 Tailwind class 片段
├── public/
│   ├── sw.js                         # Service Worker
│   ├── icons/                        # PWA 图标
│   └── fonts/                        # Outfit 字体
├── supabase/migrations/              # 数据库迁移文件
├── scraper/                          # 独立 Kaitorix 抓取服务
├── types/database.types.ts           # Supabase 类型定义
├── middleware.ts                     # 路由保护
└── tailwind.config.ts
```

## 数据库概览

### 主要表

- `transactions`：采购交易、库存数量、付款拆分、ROI、状态和编辑历史来源。
- `sales_records`：单笔或分批销售记录。
- `return_records`：退货记录。
- `payment_methods` / `bank_accounts`：支付方式与账户管理。
- `coupons` / `coupon_usage_history`：优惠券与使用历史。
- `supplies_costs` / `fixed_costs`：耗材与固定成本。
- `points_platforms` / `purchase_platforms` / `selling_platforms`：积分、采购、销售平台配置。
- `transaction_history`：交易字段变更历史。
- `notifications` / `push_subscriptions`：站内通知与 Web Push 订阅。
- `user_preferences`：用户级 UI 偏好，如交易列表列设置。
- `user_roles`：管理员角色。
- `user_line_links`：用户与 LINE 账号绑定关系。

### 视图与触发器

- `financial_water_level`：财务安全水位。
- `upcoming_payments`：30 天内待付款。
- `pending_points`：待确认积分。
- `set_user_id()`：插入时自动写入当前用户。
- `update_transaction_status()`：基于销售和退货记录重算交易状态与 ROI。
- `record_transaction_change()`：记录交易编辑历史。

所有核心业务表启用 RLS，按 `auth.uid()` 隔离用户数据。管理员读取权限通过 `user_roles` 与 `is_admin()` 放宽。

## 认证、PWA 与通知

- Supabase Auth 支持邮箱密码、Google OAuth 和邀请用户注册。
- `middleware.ts` 保护业务页面，`/auth/*` 和 `/api/*` 为公开路径。
- PWA 使用 `app/manifest.ts` 和 `public/sw.js`，支持 iOS 添加到主屏幕。
- 通知中心使用 Supabase Realtime 更新未读数。
- Web Push 需要 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 和 `VAPID_PRIVATE_KEY`。
- `/api/push/daily` 用于每日优惠券提醒，可由 Vercel Cron 触发；`LINE_REMINDER_URL` 为可选的 LINE fallback 集成。

## 开发命令

```bash
npm run dev          # 启动开发服务器，默认 localhost:3000
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run type-check   # TypeScript 类型检查
```

项目当前没有 Jest / Vitest / Playwright 测试框架。手动测试入口包括 `/api/ocr/test` 和开发环境下通知页的测试推送面板。

## 设计系统

- UI 已从 Apple 语义色迁移到 SNUtils 风格主题变量，主要 token 定义在 `app/globals.css`。
- `lib/theme.ts` 提供常用卡片、按钮、输入框、布局和提示样式。
- 图标统一使用 `lucide-react`，避免新增手写 SVG。
- 顶部桌面 banner、深浅色切换按钮、侧边栏和移动底部导航由 `components/Navigation.tsx` 统一控制。

## Scraper

`scraper/` 是独立 Node.js 项目，不属于 Next.js PWA 构建。它监听 Supabase 的 Kaitorix 抓取队列，用 Playwright 获取价格并写回 `kaitorix_price_cache`。详细启动方式见 `scraper/README.md`。

## 部署

- 推荐部署到 Vercel。
- 数据库和 Storage 使用 Supabase。
- 生产环境需要配置 `.env.local.example` 中列出的服务端和客户端变量。
- 如果启用 Web Push，每日提醒可使用 Vercel Cron 调用 `/api/push/daily`。
