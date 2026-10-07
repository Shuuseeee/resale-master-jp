-- 16_realtime_notifications.sql
-- 将 notifications 表加入 supabase_realtime publication，确保前端 Realtime 订阅可用。
-- 幂等：若表已在 publication 中则跳过，避免重复执行报错。

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
