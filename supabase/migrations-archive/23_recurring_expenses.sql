-- 23_recurring_expenses.sql（2026-10-11）
-- 定期经费（对齐买取X）：登记一条规则（分类 / 金额 / 每周·每月·每年 / 开始日 / 可选结束日），
-- 到期的那几笔由 generate_recurring_expenses() 补记进 supplies_costs（web 每次打开应用时调用一次）。
-- 第 k 笔（k 从 0 起）的日期 = start_date + k × 周期，按 generated_count 推进：
--   用户删掉某笔自动生成的经费不会被补回；月末开始（如 31 日）在短月记在月末、下个月仍回到 31 日。
-- 可重复执行。

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  description text,
  notes text,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  start_date date NOT NULL,
  end_date date CHECK (end_date IS NULL OR end_date >= start_date),
  active boolean DEFAULT true NOT NULL,
  generated_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id ON public.recurring_expenses USING btree (user_id);

DROP TRIGGER IF EXISTS set_updated_at_recurring_expenses ON public.recurring_expenses;
CREATE TRIGGER set_updated_at_recurring_expenses BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users manage their own recurring expenses" ON public.recurring_expenses
  FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- 自动生成的经费指回规则；删规则时已记的经费保留（只断开关联）
ALTER TABLE public.supplies_costs ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_supplies_costs_recurring_id ON public.supplies_costs USING btree (recurring_id) WHERE (recurring_id IS NOT NULL);

-- 补记当前用户所有启用规则中到期（≤ 今天，日本时间）的经费，返回新记的笔数。
-- SECURITY INVOKER：只能动自己的规则与经费（RLS）；FOR UPDATE 锁住规则行，两个标签页同时调用也不会重复记。
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = public
AS $function$
DECLARE
  r public.recurring_expenses%ROWTYPE;
  today date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  step interval;
  d date;
  k integer;
  total integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT * FROM public.recurring_expenses
    WHERE user_id = auth.uid() AND active AND start_date <= today
    FOR UPDATE
  LOOP
    step := CASE r.frequency WHEN 'weekly' THEN interval '7 days' WHEN 'monthly' THEN interval '1 month' ELSE interval '1 year' END;
    k := r.generated_count;
    LOOP
      d := (r.start_date + k * step)::date;
      EXIT WHEN d > today OR (r.end_date IS NOT NULL AND d > r.end_date);
      INSERT INTO public.supplies_costs (user_id, category, amount, purchase_date, description, notes, recurring_id)
      VALUES (r.user_id, r.category, r.amount, d, r.description, r.notes, r.id);
      k := k + 1;
    END LOOP;
    IF k > r.generated_count THEN
      UPDATE public.recurring_expenses SET generated_count = k WHERE id = r.id;
      total := total + (k - r.generated_count);
    END IF;
  END LOOP;

  RETURN total;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_recurring_expenses() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_expenses() TO authenticated;

-- 核对（只读）：应返回 1 行表、1 个函数、supplies_costs 多出 recurring_id 列
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recurring_expenses') AS 表,
  (SELECT count(*) FROM pg_proc WHERE proname = 'generate_recurring_expenses') AS 函数,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplies_costs' AND column_name = 'recurring_id') AS 关联列;
