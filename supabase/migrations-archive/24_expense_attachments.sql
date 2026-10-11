-- 24_expense_attachments.sql（2026-10-11）
-- 经费凭证附件（对齐买取X）：收据照片 / PDF。
-- 文件放【私有】存储桶 expense-receipts，路径 {user_id}/{经费 id}/{随机名}，只有本人能读写（按第一层文件夹 = auth.uid() 校验）；
-- 查看时用短时签名地址。元数据存 expense_attachments（列表显示件数、编辑页列出附件）。
-- 不用现有的 receipts 桶：它是公开桶，且策略不分用户（任何登录用户都能删改别人的文件）。
-- 删除经费时附件行随之级联删除；存储里的文件由 web 删除经费时先删（原生 App 删经费会留下孤立文件，不影响使用）。
-- 可重复执行。

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-receipts', 'expense-receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS expense_receipts_select_own ON storage.objects;
DROP POLICY IF EXISTS expense_receipts_insert_own ON storage.objects;
DROP POLICY IF EXISTS expense_receipts_delete_own ON storage.objects;
CREATE POLICY expense_receipts_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY expense_receipts_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY expense_receipts_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.expense_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.supplies_costs(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense_id ON public.expense_attachments USING btree (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_attachments_user_id ON public.expense_attachments USING btree (user_id);

ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own expense attachments" ON public.expense_attachments;
CREATE POLICY "Users manage their own expense attachments" ON public.expense_attachments
  FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- 核对（只读）：应返回 私有桶 false、表 1、存储策略 3
SELECT
  (SELECT public FROM storage.buckets WHERE id = 'expense-receipts') AS 公开,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_attachments') AS 表,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'expense_receipts_%') AS 存储策略;
