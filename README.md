# Sale System - 日本转卖业务财务管理系统

一个专为日本转卖业务设计的全功能财务管理 PWA，支持批量库存管理、多维度数据分析和日本税务申报。

## 🚀 核心功能

### 交易管理
- ✅ **批量库存管理**: 支持单笔采购多件商品,分批销售跟踪
- 💰 **混合支付录入**: 支持信用卡、积分、余额的组合支付
- 📊 **智能计算**: 自动计算 ROI、还款日期和利润
- 🔄 **退货处理**: 完整的退货流程,自动重算利润和积分扣除
- 📸 **凭证管理**: 支持图片上传(含 HEIC 格式)和自动压缩
- 📱 **JAN 码扫描**: 相机扫码自动匹配商品信息和买取价格

### 财务管理
- 💳 **支付方式管理**: 管理多张信用卡和电子钱包,自动计算还款日
- 🏦 **银行账户**: 追踪多个银行账户余额
- 🎯 **积分平台系统**: 9 个预配置积分平台(PayPay、V Point、乐天、Amazon等),精确计算积分价值
- 🎫 **优惠券管理**: 追踪优惠券使用和过期状态
- 📦 **耗材成本**: 自动分摊包装材料、运输用品等成本

### 数据分析与报表
- 📈 **数据分析仪表盘**: 7 种交互式图表,多时间维度分析
- 💹 **财务安全水位**: 实时监控资金安全状态
- 📅 **待付款提醒**: 30 天内到期付款汇总
- 🧾 **日本税务申报**: 符合确定申告要求的报表,支持 Excel/PDF 导出

## 📦 技术栈

- **前端框架**: Next.js 15 (App Router) + React 19
- **样式**: Tailwind CSS
- **类型安全**: TypeScript
- **数据库**: Supabase (PostgreSQL + Auth + Storage)
- **PWA**: Service Worker + Web Push Notifications + Manifest
- **图表**: Recharts
- **导出**: jsPDF (日文字体支持) + XLSX
- **图片处理**: heic2any (支持 iPhone HEIC 格式)
- **AI OCR**: Anthropic Claude API (优惠券图片识别)

## 🛠️ 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd resale-master-jp
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.local.example` 到 `.env.local`:

```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 并填入凭据:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
KAITORIX_API_TOKENS=          # 可选：买取价格查询 API
```

### 4. 设置数据库

在 Supabase Dashboard → SQL Editor 中依次执行迁移文件:

1. `supabase/migrations/00_initial_schema.sql` — 完整初始结构
2. `supabase/migrations/05_fix_scraper_queue_atomic.sql`
3. `supabase/migrations/06_transaction_history.sql`
4. `supabase/migrations/07_admin_role.sql`
5. `supabase/migrations/08_seed_admin_users.sql`

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 📁 项目结构

```
resale-master-jp/
├── app/
│   ├── layout.tsx                    # 根布局 + PWA 注册
│   ├── manifest.ts                   # PWA Manifest
│   ├── globals.css                   # 全局样式
│   ├── api/                          # API Routes
│   │   ├── kaitorix/[jan]/           # 买取价格查询
│   │   ├── jan-product/[jan]/        # 商品信息查询
│   │   ├── ocr/coupon/               # 优惠券 OCR (Claude AI)
│   │   └── push/                     # 推送通知
│   ├── auth/                         # 认证页面 (login / register)
│   ├── dashboard/                    # 仪表盘
│   ├── transactions/                 # 交易管理 (列表/新增/编辑/详情)
│   ├── coupons/                      # 优惠券管理
│   ├── supplies/                     # 耗材成本管理
│   ├── analytics/                    # 数据分析
│   ├── tax-report/                   # 税务申报
│   ├── notifications/                # 通知
│   ├── settings/                     # 设置 (支付方式)
│   └── admin/                        # 管理工具
├── components/                       # 共用 React 组件
├── contexts/
│   ├── AuthContext.tsx               # 认证状态
│   └── PlatformsContext.tsx          # 平台数据
├── hooks/                            # 自定义 hooks
├── lib/
│   ├── supabase/client.ts            # Supabase 客户端
│   ├── api/                          # 按业务域划分的数据库调用
│   └── financial/calculator.ts      # ROI 和利润计算
├── public/
│   └── sw.js                         # Service Worker
├── types/
│   └── database.types.ts             # TypeScript 类型定义
├── supabase/
│   └── migrations/                   # 数据库迁移文件
├── scraper/                          # 独立 Node.js 项目 (kaitorix 价格抓取, 不属于本 PWA)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 💾 数据库设计

### 核心表结构

1. **transactions** - 交易记录
   - **批量库存**: quantity / quantity_sold / quantity_in_stock
   - **混合支付**: card_paid + point_paid + balance_paid = purchase_price_total
   - **利润追踪**: cash_profit, total_profit, roi
   - **状态管理**: in_stock, sold, returned

2. **sales_records** - 销售记录
   - 支持单笔交易多次销售，独立计算每次利润和 ROI

3. **payment_methods** - 支付方式
   - 信用卡、银行账户、电子钱包；自动计算还款日

4. **bank_accounts** - 银行账户

5. **coupons** - 优惠券
   - 折扣类型、起止时间、使用状态跟踪

6. **supplies_costs** / **fixed_costs** - 耗材与固定成本

7. **points_platforms** - 积分平台 (9 个预配置)

### 数据库视图

- **financial_water_level** — 财务安全水位（总余额 / 30 天待付款）
- **upcoming_payments** — 30 天内到期付款汇总
- **pending_points** — 待确认积分

### 数据库特性

- **Row Level Security (RLS)**: 所有表启用，多用户数据隔离
- **自动触发器**: `set_user_id()` 自动分配用户、`update_transaction_status()` 重算 ROI、`record_transaction_change()` 记录编辑历史

### ROI 计算公式

```
ROI = 总利润 / 实际现金支出 × 100%

其中:
- 现金利润 = 销售价格 - 采购成本 - 平台费用 - 运费 - 分摊耗材成本
- 积分价值 = Σ(积分数量 × 平台兑换率)
- 总利润 = 现金利润 + 积分价值
- 实际现金支出 = 采购成本 - 积分抵扣
```

## 🔐 认证与权限

- Supabase Auth (邮箱/密码 + Google OAuth)
- 中间件路由保护，未登录重定向至 `/auth/login`
- 管理员权限通过 `user_roles` 表管理，变更立即生效

### 管理员操作

```sql
-- 添加管理员
INSERT INTO public.user_roles (user_id, role)
VALUES ('<用户UUID>', 'admin')
ON CONFLICT DO NOTHING;

-- 移除管理员
DELETE FROM public.user_roles
WHERE user_id = '<用户UUID>' AND role = 'admin';
```

## 🚀 部署

- **平台**: Vercel
- **数据库**: Supabase (PostgreSQL)
- **存储**: Supabase Storage (`receipts` bucket)

## 🔧 开发命令

```bash
npm run dev          # 启动开发服务器 (localhost:3000)
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run type-check   # TypeScript 类型检查
```

## ✅ 已实现功能

- [x] 用户认证 (邮箱/密码 + Google OAuth)
- [x] 仪表盘 (财务安全水位、待付款、待确认积分)
- [x] 交易管理 (列表、新增、编辑、详情、筛选、多选批操作)
- [x] 批量库存管理 (多件商品分批销售)
- [x] JAN 码扫描与买取价格对比
- [x] 退货处理
- [x] 支付方式管理
- [x] 积分平台系统 (9 个预配置平台)
- [x] 优惠券管理 (含 AI OCR 自动识别)
- [x] 耗材成本管理
- [x] 数据分析仪表盘 (7 种图表)
- [x] 日本税务申报 (Excel/PDF 导出)
- [x] PWA (离线缓存、桌面安装、推送通知)
- [x] 管理员权限系统
- [x] 交易编辑历史记录

---

**Sale System** - 让日本转卖业务管理更简单
