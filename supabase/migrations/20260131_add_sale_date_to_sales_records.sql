-- Add sale_date column to sales_records table
-- This field records the actual date when the sale was completed
-- Critical for accurate tax reporting and revenue analysis

-- Add the sale_date column (nullable initially for existing records)
ALTER TABLE sales_records
ADD COLUMN sale_date DATE;

-- Add comment to explain the field
COMMENT ON COLUMN sales_records.sale_date IS '販売日 - 実際に商品が販売された日付。税務申告と収益分析に使用';

-- Note: Existing records will have NULL sale_date
-- Users must manually update these records through the UI
