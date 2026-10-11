-- 25_receipts_bucket_policies.sql（2026-10-11）
-- 交易收据桶 receipts 的权限收紧。原来的问题：
--   ① 「Public can view receipt images」对所有人（含未登录）开放 SELECT → 任何人拿项目公开的 anon key 就能列出全部收据文件名，再用公开地址逐个打开
--   ② 上传 / 修改 / 删除只校验桶名 → 任何登录用户都能删除或覆盖别人的收据
-- 改法（不需要原生 App 改版）：
--   · 桶保持 public：原生 App 存的是公开地址（getPublicURL），改私有会让 App 里已有的收据立刻打不开。
--     公开地址的文件名是随机 UUID，不能列目录就猜不到；这一层等原生改成「存路径 + 显示时签名」后再改私有。
--   · 去掉对所有人的 SELECT（公开桶的公开地址下载不经过这条策略，不受影响）；本人仍可列 / 签名自己的文件。
--   · 上传只许传到自己的文件夹 {user_id}/（原生一直如此；web 2026-10-11 起也改成这样）。
--   · 修改 / 删除只许动自己的文件：在自己的文件夹里，或旧的根目录文件由自己上传（owner_id）。
-- 已存进 transactions.image_url 的签名地址 / 公开地址都继续有效。可重复执行。

-- 预览（只读）：按「在用户文件夹里 / 根目录」「有没有上传者」统计现有文件
SELECT
  CASE WHEN array_length(storage.foldername(name), 1) >= 1 THEN '用户文件夹' ELSE '根目录' END AS 位置,
  (owner_id IS NOT NULL) AS 有上传者,
  count(*) AS 文件数
FROM storage.objects
WHERE bucket_id = 'receipts'
GROUP BY 1, 2
ORDER BY 1, 2;

DROP POLICY IF EXISTS "Public can view receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipt images" ON storage.objects;
DROP POLICY IF EXISTS receipts_select_own ON storage.objects;
DROP POLICY IF EXISTS receipts_insert_own ON storage.objects;
DROP POLICY IF EXISTS receipts_update_own ON storage.objects;
DROP POLICY IF EXISTS receipts_delete_own ON storage.objects;

CREATE POLICY receipts_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR owner_id = auth.uid()::text));
CREATE POLICY receipts_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY receipts_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR owner_id = auth.uid()::text))
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY receipts_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR owner_id = auth.uid()::text));

-- 核对（只读）：应只剩 4 条 receipts_*_own，且没有 TO public 的
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'storage' AND (policyname LIKE 'receipts_%' OR policyname LIKE '%receipt images%')
ORDER BY policyname;
