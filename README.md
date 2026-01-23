# Resale Master JP - 转卖账务管理系统

一个专为日本转卖业务设计的现代化账务管理系统,支持混合支付、积分管理和智能还款日推算。

## 🚀 核心功能

- ✅ **混合支付录入**: 支持信用卡、积分、余额的组合支付
- 📊 **智能计算**: 自动计算 ROI、还款日期和利润
- 💳 **多支付方式**: 管理多张信用卡和电子钱包
- 🎯 **积分跟踪**: 追踪平台积分和信用卡积分
- 📸 **凭证上传**: 支持图片上传和自动压缩
- 📱 **移动优先**: 响应式设计,完美适配手机端

## 📦 技术栈

- **前端框架**: Next.js 15 (App Router)
- **样式**: Tailwind CSS
- **类型安全**: TypeScript
- **数据库**: Supabase (PostgreSQL)
- **存储**: Supabase Storage
- **UI设计**: 现代暗色主题,流畅动画

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

编辑 `.env.local` 并填入您的 Supabase 凭据:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 设置数据库

在 Supabase 项目中执行 `supabase-schema.sql`:

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制并执行 `supabase-schema.sql` 中的所有 SQL 语句

### 5. 创建 Storage Bucket

在 Supabase Dashboard 中:

1. 进入 Storage
2. 创建名为 `receipts` 的 bucket
3. 设置为 Public bucket

### 6. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 📁 项目结构

```
resale-master-jp/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── globals.css             # 全局样式
│   └── transactions/
│       └── add/
│           └── page.tsx        # 交易录入页面
├── lib/
│   └── supabase/
│       └── client.ts           # Supabase 客户端配置
├── types/
│   └── database.types.ts       # TypeScript 类型定义
├── supabase-schema.sql         # 数据库 Schema
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 💾 数据库设计

### 核心表结构

1. **payment_methods** - 支付方式
   - 支持信用卡、银行账户、电子钱包
   - 记录账单日、还款日、积分倍率

2. **transactions** - 交易记录
   - 混合支付逻辑 (信用卡 + 积分 + 余额)
   - 自动计算利润和 ROI
   - 智能推算还款日期
   - 图片凭证存储

3. **fixed_costs** - 固定成本
   - 月度/年度订阅费用
   - 会员费管理

4. **coupons** - 优惠券
   - 过期时间管理
   - 使用状态跟踪

## 🎨 UI/UX 特性

- **暗色主题**: 现代化的渐变背景和玻璃拟态效果
- **流畅动画**: 优雅的过渡和微交互
- **智能表单**: 自动计算和实时验证
- **响应式设计**: 完美适配手机、平板和桌面

## 🔒 安全性

- Row Level Security (RLS) 启用
- 认证用户权限控制
- 环境变量保护敏感信息

## 📝 使用指南

### 录入新交易

1. 访问"记录新交易"页面
2. 填写基本信息 (日期、商品名称)
3. 输入采购总价
4. 选择支付方式并分配金额:
   - 信用卡支付 (需选择卡片)
   - 积分抵扣
   - 余额支付 (自动计算)
5. 填写预期积分
6. 上传采购凭证 (可选)
7. 添加备注 (可选)
8. 提交保存

### 混合支付逻辑

系统会自动验证: `信用卡支付 + 积分抵扣 + 余额支付 = 采购总价`

### 还款日计算

系统会根据:
- 交易日期
- 信用卡的账单日
- 信用卡的还款日

自动计算预计还款日期。

### ROI 计算公式

```
ROI = (现金利润 + 积分价值) / 采购成本

其中:
- 现金利润 = 销售价 - 平台费 - 运费 - 采购成本
- 积分价值 = (平台积分 + 信用卡积分) × 0.01
```

## 🚧 开发计划

- [ ] 交易列表页面
- [ ] 交易详情页面
- [ ] 编辑交易功能
- [ ] 仪表盘和统计
- [ ] 利润分析
- [ ] 导出功能
- [ ] 优惠券管理
- [ ] 固定成本管理

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📧 联系方式

如有问题,请通过 Issue 联系。