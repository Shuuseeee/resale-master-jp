-- 28_quantity_not_below_arrived.sql（2026-10-11）
-- 进货数量不能改到比已到货数量还少（之前编辑页 / 原生 App 都能改成「到货 5/3」，可售件数超过进货数）。
-- 把 quantity_arrived 的检查约束扩成 0 ≤ 已到货 ≤ 数量。可重复执行。

-- ① 先查有没有已经不合规的行（应为 0 行；有的话先手动修正数量或到货明细再执行 ②）
SELECT id, product_name, quantity, quantity_arrived
FROM public.transactions
WHERE quantity_arrived IS NOT NULL AND quantity_arrived > quantity;

-- ② 换约束
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_quantity_arrived_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_quantity_arrived_check
  CHECK (((quantity_arrived IS NULL) OR ((quantity_arrived >= 0) AND (quantity_arrived <= quantity))));
