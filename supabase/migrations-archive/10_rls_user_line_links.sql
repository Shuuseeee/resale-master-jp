-- 10_rls_user_line_links.sql
-- 修复：为 user_line_links 表启用 RLS（Supabase Linter 安全告警）
-- 该表存储用户与 LINE 账号的绑定关系，需要行级隔离

alter table public.user_line_links enable row level security;

-- 用户只能查看/操作自己的绑定记录
create policy "user reads own line links"
  on public.user_line_links for select
  using (auth.uid() = user_id);

create policy "user inserts own line links"
  on public.user_line_links for insert
  with check (auth.uid() = user_id);

create policy "user updates own line links"
  on public.user_line_links for update
  using (auth.uid() = user_id);

create policy "user deletes own line links"
  on public.user_line_links for delete
  using (auth.uid() = user_id);
