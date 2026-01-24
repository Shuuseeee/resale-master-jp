# 数据库迁移说明

## 添加 payment_same_month 字段

此迁移为 `payment_methods` 表添加 `payment_same_month` 字段，用于支持信用卡当月还款和次月还款两种模式。

### 执行步骤

1. **在 Supabase Dashboard 中执行 SQL**
   - 登录 Supabase Dashboard: https://app.supabase.com
   - 选择你的项目
   - 进入 SQL Editor
   - 复制并执行 `supabase/migrations/add_payment_same_month.sql` 中的 SQL 语句

2. **验证字段是否添加成功**
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'payment_methods'
   AND column_name = 'payment_same_month';
   ```

3. **更新现有信用卡配置**
   ```sql
   -- 查看所有信用卡
   SELECT id, name, payment_same_month FROM payment_methods WHERE type = 'card';

   -- 设置某张卡为当月还款
   UPDATE payment_methods
   SET payment_same_month = true
   WHERE name = '您的信用卡名称';
   ```

### 字段说明

- **payment_same_month**: BOOLEAN
  - `true`: 当月还款（账单日和还款日在同一个月）
  - `false`: 次月还款（默认值，还款日在账单日的下个月）

### 示例场景

#### 场景 1: 次月还款（传统信用卡）
- 账单日: 每月 25 日
- 还款日: 次月 15 日
- payment_same_month: `false`
- 交易日期: 2024-01-10
- 预计还款: 2024-02-15

#### 场景 2: 当月还款（部分信用卡）
- 账单日: 每月 15 日
- 还款日: 每月 28 日
- payment_same_month: `true`
- 交易日期: 2024-01-10
- 预计还款: 2024-01-28

### 回滚（如需要）

```sql
ALTER TABLE payment_methods DROP COLUMN IF EXISTS payment_same_month;
```

---

## 常见问题

**Q: 如何知道我的信用卡是当月还款还是次月还款？**
A: 查看信用卡账单或联系银行客服确认。一般来说：
- 大部分信用卡：账单日 → 次月还款日（次月还款）
- 部分储蓄卡联名卡：账单日 → 当月还款日（当月还款）

**Q: 如果设置错了怎么办？**
A: 可以随时在 Supabase 中更新 payment_same_month 字段的值。

**Q: 这个字段对现有数据有影响吗？**
A: 默认值为 `false`（次月还款），与之前的逻辑一致，不会影响现有数据。
