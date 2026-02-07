# Sale System - 日本转卖业务财务管理系统

一个专为日本转卖业务设计的全功能财务管理系统,支持批量库存管理、多维度数据分析和日本税务申报。

## 🚀 核心功能

### 交易管理
- ✅ **批量库存管理**: 支持单笔采购多件商品,分批销售跟踪
- 💰 **混合支付录入**: 支持信用卡、积分、余额的组合支付
- 📊 **智能计算**: 自动计算 ROI、还款日期和利润
- 🔄 **退货处理**: 完整的退货流程,自动重算利润和积分扣除
- 📸 **凭证管理**: 支持图片上传(含 HEIC 格式)和自动压缩

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
- 📱 **移动优先**: 响应式设计,完美适配手机端

## 📦 技术栈

- **前端框架**: Next.js 15 (App Router) + React 19
- **样式**: Tailwind CSS
- **类型安全**: TypeScript
- **数据库**: Supabase (PostgreSQL + Auth + Storage)
- **图表**: Recharts
- **导出**: jsPDF (日文字体支持) + XLSX
- **日期选择**: react-datepicker
- **图片处理**: heic2any (支持 iPhone HEIC 格式)
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

在 Supabase 项目中执行整合后的迁移文件:

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制并执行 `supabase/migrations/00_initial_schema.sql` 中的所有 SQL 语句

**注意**: 该文件已整合所有数据库 schema，包括：
- 用户认证和 RLS
- 积分平台系统（9 个平台）
- ROI 和利润计算
- 存储桶配置
- 批量库存管理

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
│   ├── layout.tsx                    # 根布局
│   ├── globals.css                   # 全局样式
│   ├── auth/                         # 认证页面
│   │   ├── login/                    # 登录
│   │   └── register/                 # 注册
│   ├── dashboard/                    # 仪表盘
│   ├── transactions/                 # 交易管理
│   │   ├── page.tsx                  # 交易列表
│   │   ├── add/                      # 新增交易
│   │   └── [id]/                     # 交易详情和编辑
│   ├── accounts/                     # 银行账户管理
│   ├── points/                       # 积分管理
│   ├── coupons/                      # 优惠券管理
│   ├── supplies/                     # 耗材成本管理
│   ├── analytics/                    # 数据分析
│   ├── tax-report/                   # 税务申报
│   ├── settings/                     # 设置
│   │   └── payment-methods/          # 支付方式管理
│   └── admin/                        # 管理工具
├── components/
│   ├── Navigation.tsx                # 导航组件
│   ├── TransactionFilters.tsx        # 交易筛选器
│   ├── TransactionCard.tsx           # 交易卡片组件
│   ├── TransactionRow.tsx            # 交易行组件
│   ├── DatePicker.tsx                # 日期选择器
│   ├── SalesRecordsList.tsx          # 销售记录列表
│   ├── BatchSaleForm.tsx             # 批量销售表单
│   ├── Modal.tsx                     # 模态框组件
│   ├── OptimizedImage.tsx            # 优化图片组件
│   ├── Calculator.tsx                # 桌面计算器
│   ├── CalculatorButton.tsx          # 计算器按钮
│   ├── CalculatorProvider.tsx        # 计算器上下文
│   └── ClientProviders.tsx           # 客户端提供者
├── lib/
│   ├── supabase/
│   │   └── client.ts                 # Supabase 客户端
│   ├── api/                          # API 函数
│   │   ├── analytics.ts              # 分析 API
│   │   ├── financial.ts              # 财务 API
│   │   ├── points-platforms.ts       # 积分平台 API
│   │   ├── sales-records.ts          # 销售记录 API
│   │   ├── supplies.ts               # 耗材 API
│   │   └── tax-report.ts             # 税务申报 API
│   ├── financial/
│   │   └── calculator.ts             # 财务计算器
│   ├── image-utils.ts                # 图片工具
│   ├── number-utils.ts               # 数字工具
│   ├── pdf-font-loader.ts            # PDF 字体加载器
│   └── theme.ts                      # 主题配置
├── contexts/
│   └── AuthContext.tsx               # 认证上下文
├── types/
│   └── database.types.ts             # TypeScript 类型定义
├── supabase/
│   └── migrations/
│       └── 00_initial_schema.sql     # 整合后的数据库 schema (605 行)
├── docs/                             # 技术文档
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 💾 数据库设计

### 核心表结构

1. **points_platforms** - 积分平台
   - 9 个预配置平台 (PayPay、V Point、乐天、Amazon等)
   - 积分兑换率 (1:1, 3:1 等)
   - 精确计算积分价值

2. **payment_methods** - 支付方式
   - 支持信用卡、银行账户、电子钱包
   - 记录账单日、还款日、积分倍率
   - 关联积分平台

3. **bank_accounts** - 银行账户
   - 账户类型: 支票账户、储蓄账户、电子钱包
   - 实时余额追踪

4. **transactions** - 交易记录
   - **批量库存**: quantity (总数量), quantity_sold (已售), quantity_in_stock (库存)
   - **混合支付**: card_paid + point_paid + balance_paid = purchase_price_total
   - **利润追踪**: cash_profit, total_profit, roi
   - **积分追踪**: expected_platform_points, expected_card_points, extra_platform_points
   - **退货处理**: return_date, return_amount, return_notes, points_deducted
   - **状态管理**: in_stock, sold, returned
   - 图片凭证存储 (Supabase Storage)

5. **sales_records** - 销售记录
   - 支持单笔交易多次销售
   - 自动更新 transaction.quantity_sold
   - 独立计算每次销售的利润和 ROI

6. **coupons** - 优惠券
   - 折扣类型: 百分比、固定金额、免运费
   - 过期时间管理
   - 使用状态跟踪

7. **supplies_costs** - 耗材成本
   - 类别: 包装材料、运输用品、标签打印、其他
   - 自动分摊到交易利润计算

8. **fixed_costs** - 固定成本
   - 月度/年度订阅费用
   - 会员费管理

### 数据库视图

1. **financial_water_level** - 财务安全水位
   - 实时计算: 总余额 / 30 天内待付款
   - 安全等级: safe (>150%), warning (100-150%), danger (<100%)

2. **upcoming_payments** - 待付款汇总
   - 按还款日期聚合
   - 30 天内到期付款

3. **pending_points** - 待确认积分
   - 按紧急程度分级
   - 自动提醒确认

### 数据库特性

- **Row Level Security (RLS)**: 所有表启用,多用户数据隔离
- **自动触发器**:
  - 自动分配 user_id
  - 自动重算 ROI
  - 自动更新 quantity_sold
- **级联删除**: 用户删除时自动清理关联数据
- **时间戳**: 自动维护 created_at 和 updated_at

## 🎨 UI/UX 特性

- **暗色主题**: 现代化的渐变背景和玻璃拟态效果
- **流畅动画**: 优雅的过渡和微交互
- **智能表单**: 自动计算和实时验证
- **响应式设计**: 完美适配手机、平板和桌面
- **交互式图表**: Recharts 驱动的数据可视化
- **自定义日期选择器**: 优化的日期输入体验
- **桌面端计算器**: 数字输入页面的专用计算器，提升输入效率
- **图片预览**: 支持多种格式的图片查看
- **加载状态**: 清晰的加载和错误提示
- **无障碍访问**: 符合 WCAG 2 AA 标准的颜色对比度

## 📚 项目文档

本 README 包含完整的项目文档，包括：
- 核心功能说明
- 快速开始指南
- 数据库设计详解
- 使用指南
- 部署说明
- 开发指南

## 📝 使用指南

### 首次使用

1. **注册账户**: 访问 `/auth/register` 创建账户
2. **添加支付方式**: 在"设置 > 支付方式"中添加信用卡或电子钱包
3. **添加银行账户**: 在"账户管理"中添加银行账户
4. **开始记录交易**: 访问"记录新交易"页面

### 录入新交易

1. 访问"记录新交易"页面
2. 填写基本信息:
   - 交易日期
   - 商品名称
   - 采购总价
   - **数量** (支持批量采购)
3. 选择支付方式并分配金额:
   - 信用卡支付 (需选择卡片,自动计算还款日)
   - 积分抵扣 (从积分平台选择)
   - 余额支付 (自动计算剩余金额)
4. 填写预期积分:
   - 平台积分 (选择积分平台)
   - 信用卡积分 (自动根据倍率计算)
5. 上传采购凭证 (支持 JPG、PNG、HEIC 格式)
6. 添加备注 (可选)
7. 提交保存

### 批量库存管理

**适用场景**: 一次采购多件相同商品,分批销售

1. 在交易详情页查看:
   - 总数量 (quantity)
   - 已售数量 (quantity_sold)
   - 库存数量 (quantity_in_stock)
2. 点击"记录销售"添加销售记录:
   - 销售数量
   - 单价
   - 平台费用
   - 运费
3. 系统自动:
   - 更新已售数量和库存
   - 计算本次销售利润和 ROI
   - 更新交易总利润

### 退货处理

1. 在交易详情页点击"标记为退货"
2. 填写退货信息:
   - 退货日期
   - 退款金额
   - 扣除的积分
   - 退货备注
3. 系统自动重算利润和 ROI

### 数据分析

访问"数据分析"页面查看:
- **收入趋势**: 按日/周/月/季度/年查看
- **利润分析**: 现金利润 vs 积分价值
- **支付方式分布**: 各支付方式使用情况
- **成本结构**: 采购成本、平台费用、运费、耗材
- **ROI 趋势**: 投资回报率变化
- **交易量统计**: 交易数量和平均值
- **积分收益**: 各积分平台收益对比

### 税务申报

访问"税务申报"页面:
1. 选择申报年度
2. 查看汇总数据:
   - 现金收入
   - 积分收入 (按平台分类)
   - 必要经费 (采购成本、平台费用、运费、耗材、固定成本)
3. 导出报表:
   - **Excel 导出**: 详细交易记录
   - **PDF 导出**: 日文格式申报表

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
ROI = 总利润 / 实际现金支出 × 100%

其中:
- 现金利润 = 销售价格 - 采购成本 - 平台费用 - 运费 - 分摊耗材成本
- 积分价值 = Σ(积分数量 × 积分平台兑换率)
  - 平台积分价值 = 平台积分 × 平台兑换率
  - 信用卡积分价值 = 信用卡积分 × 信用卡积分平台兑换率
- 总利润 = 现金利润 + 积分价值
- 实际现金支出 = 采购成本 - 积分抵扣

注意:
- 耗材成本按月自动分摊到所有交易
- 批量交易的 ROI 会随着销售记录动态更新
- 退货会自动重算利润和 ROI
```

## 🔐 安全性与多用户支持

### 认证系统
- Supabase Auth 邮箱密码认证
- 会话管理和自动刷新
- 中间件路由保护
- 支持多用户注册

### 数据隔离
- **Row Level Security (RLS)**: 所有表启用
- 用户只能访问自己的数据
- 自动 user_id 分配
- 完整的 CRUD 权限控制

### 数据保护
- 环境变量保护敏感信息
- 图片使用签名 URL 访问
- HTTPS 生产环境
- 用户删除时级联清理数据

## 🚀 部署

### 生产环境
- **平台**: Vercel
- **数据库**: Supabase (PostgreSQL)
- **存储**: Supabase Storage
- **状态**: ✅ 生产就绪

### 环境变量
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 部署步骤
1. Fork 本仓库
2. 在 Vercel 导入项目
3. 配置环境变量
4. 部署完成

## 📊 项目统计

- **总代码行数**: ~15,000+ 行
- **页面数量**: 24 个页面
- **组件数量**: 13+ 个可复用组件
- **API 模块**: 6 个 API 文件 + 多个工具模块
- **数据库 Schema**: 1 个整合文件 (605 行，包含完整 schema)
- **支持语言**: 日语 (主要),英文代码注释

## 🎯 已实现功能

### ✅ 完整实现
- [x] 用户认证系统 (登录/注册)
- [x] 仪表盘 (财务安全水位、待付款、待确认积分)
- [x] 交易管理 (列表、新增、编辑、详情、筛选)
- [x] 批量库存管理 (多件商品分批销售)
- [x] 销售记录追踪
- [x] 退货处理
- [x] 银行账户管理
- [x] 支付方式管理 (信用卡、电子钱包)
- [x] 积分平台系统 (9 个预配置平台)
- [x] 积分管理和追踪
- [x] 优惠券管理
- [x] 耗材成本管理
- [x] 数据分析仪表盘 (7 种图表)
- [x] 日本税务申报 (Excel/PDF 导出)
- [x] 图片上传和管理 (支持 HEIC)
- [x] 移动端响应式设计
- [x] 多用户支持和数据隔离
- [x] 自动 ROI 计算和更新
- [x] 还款日期智能推算
- [x] 桌面端计算器 (优化数字输入体验)
- [x] 无障碍访问 (WCAG 2 AA 合规)

### 🔮 未来计划
- [ ] 批量导入交易 (CSV/Excel)
- [ ] 自定义报表生成器
- [ ] 邮件/推送通知
- [ ] 多语言支持 (英文)
- [ ] 移动端 App (React Native)
- [ ] API 接口开放
- [ ] 数据备份和恢复
- [ ] 高级筛选和搜索

## 🔧 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

### 数据库 Schema

数据库 schema 已整合到单一文件 `/supabase/migrations/00_initial_schema.sql` (605 行):

**首次部署**:
1. 在 Supabase SQL Editor 中执行 `00_initial_schema.sql`
2. 该文件包含完整的数据库结构（认证、积分平台、ROI 计算、存储、批量库存等）

**后续变更**:
1. 创建增量迁移文件 (按时间戳命名，如 `20260208000000_description.sql`)
2. 在 Supabase SQL Editor 中执行
3. 提交到版本控制

**注意**:
整合文件代表数据库的最终状态，适合新环境部署。现有环境继续使用增量迁移。

### 添加新功能

1. 在 `/app` 中创建新页面
2. 在 `/lib/api` 中添加 API 函数
3. 更新 `/types/database.types.ts` 类型定义
4. 在 `/components/Navigation.tsx` 中添加导航链接
5. 创建必要的数据库迁移

## 🤝 贡献指南

欢迎贡献代码!请遵循以下步骤:

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 组件使用函数式写法
- 使用有意义的变量和函数名
- 添加必要的注释 (中文或英文)

## 📄 许可证

MIT License

## 📧 联系与支持

- **问题反馈**: 通过 GitHub Issues 提交
- **功能建议**: 通过 GitHub Discussions 讨论
- **安全问题**: 请私下联系维护者

## 🙏 致谢

本项目使用了以下优秀的开源项目:

- [Next.js](https://nextjs.org/) - React 框架
- [Supabase](https://supabase.com/) - 后端即服务
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Recharts](https://recharts.org/) - 图表库
- [jsPDF](https://github.com/parallax/jsPDF) - PDF 生成
- [SheetJS](https://sheetjs.com/) - Excel 处理

---

**Sale System** - 让日本转卖业务管理更简单 🚀