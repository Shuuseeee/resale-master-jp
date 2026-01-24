-- 添加 payment_same_month 字段到 payment_methods 表
-- 用于标识信用卡是当月还款还是次月还款

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS payment_same_month BOOLEAN NOT NULL DEFAULT false;

-- 为字段添加注释
COMMENT ON COLUMN payment_methods.payment_same_month IS '还款周期: true-当月还款, false-次月还款';

-- 示例：更新某些卡片为当月还款
-- UPDATE payment_methods SET payment_same_month = true WHERE name = '某银行信用卡';
