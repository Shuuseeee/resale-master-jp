-- 创建耗材成本表
CREATE TABLE IF NOT EXISTS public.supplies_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL, -- 耗材分类：包装材料、运输耗材、标签等
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0), -- 金额
  purchase_date DATE NOT NULL, -- 采购日期
  description TEXT, -- 描述
  notes TEXT, -- 备注
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_supplies_costs_user_id ON public.supplies_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_supplies_costs_purchase_date ON public.supplies_costs(purchase_date);
CREATE INDEX IF NOT EXISTS idx_supplies_costs_category ON public.supplies_costs(category);

-- 启用 RLS
ALTER TABLE public.supplies_costs ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own supplies costs"
  ON public.supplies_costs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplies costs"
  ON public.supplies_costs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplies costs"
  ON public.supplies_costs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplies costs"
  ON public.supplies_costs FOR DELETE
  USING (auth.uid() = user_id);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_supplies_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_supplies_costs_updated_at_trigger
  BEFORE UPDATE ON public.supplies_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_supplies_costs_updated_at();

-- 添加注释
COMMENT ON TABLE public.supplies_costs IS '耗材成本表，用于记录包装材料、运输耗材等固定成本';
COMMENT ON COLUMN public.supplies_costs.category IS '耗材分类：包装材料、运输耗材、标签打印、其他';
COMMENT ON COLUMN public.supplies_costs.amount IS '耗材采购金额（日元）';
COMMENT ON COLUMN public.supplies_costs.purchase_date IS '耗材采购日期';
