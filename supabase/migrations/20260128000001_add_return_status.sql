-- Add return status to transactions
-- This migration adds support for return functionality

-- Step 1: Add return-related columns to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS return_date DATE,
ADD COLUMN IF NOT EXISTS return_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS return_notes TEXT,
ADD COLUMN IF NOT EXISTS points_deducted INTEGER DEFAULT 0;

-- Step 2: Modify status enum to include 'returned'
-- First, add the new value to the enum
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'returned';

-- Step 3: Add comment for documentation
COMMENT ON COLUMN transactions.return_date IS '退货日期';
COMMENT ON COLUMN transactions.return_amount IS '退款金额';
COMMENT ON COLUMN transactions.return_notes IS '退货备注';
COMMENT ON COLUMN transactions.points_deducted IS '扣除的积分数量';
