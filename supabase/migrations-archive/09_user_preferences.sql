-- 09_user_preferences.sql
-- 用户偏好表：存储跨设备的 UI 配置（如列定制）
-- ⚠️ 需手动 apply 到 Supabase Dashboard SQL Editor 或 supabase db push

create table public.user_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  transactions_columns jsonb,  -- [{key:'date', visible:true}, ...] 顺序即展示顺序
  updated_at timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "user reads own prefs"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "user inserts own prefs"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user updates own prefs"
  on user_preferences for update
  using (auth.uid() = user_id);
