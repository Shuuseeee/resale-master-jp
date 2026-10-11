-- 22_expense_categories.sql（2026-10-11）
-- 耗材 → 经费：分类改成与买取X 一致的 6 类（存日文值：送料 / 交通費 / 梱包材 / 保管費 / 消耗品 / その他）
-- 旧的 4 类迁移：包装材料 → 梱包材、运输耗材 → 梱包材（缓冲材等）、标签打印 → 消耗品、其他 → その他
-- 不加 CHECK 约束：原生 App 改版前仍会写旧的中文分类。可重复执行。

-- 预览（只读）
SELECT category, count(*) AS 笔数, sum(amount) AS 金额 FROM public.supplies_costs GROUP BY category ORDER BY category;

-- 迁移
UPDATE public.supplies_costs
SET category = CASE category
  WHEN '包装材料' THEN '梱包材'
  WHEN '运输耗材' THEN '梱包材'
  WHEN '标签打印' THEN '消耗品'
  WHEN '其他' THEN 'その他'
  ELSE category
END
WHERE category IN ('包装材料', '运输耗材', '标签打印', '其他');
