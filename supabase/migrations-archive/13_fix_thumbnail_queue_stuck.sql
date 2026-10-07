-- 13_fix_thumbnail_queue_stuck.sql
-- 修复 thumbnail_scraper_queue 的 processing 卡死问题：
--   1) 把当前 stuck 在 processing 的行扔回 pending（让 worker 重新捡）
--   2) 把 dequeue 的默认 p_limit 从 5 改成 1，避免被默认值坑
--   3) dequeue 同时回收 stale processing 行（updated_at > 2 分钟前），worker 崩溃后任务不会永久挂起
--   4) 加一个监控 view 方便 SQL Editor 一眼看队列状态

-- ──────────────────────────────────────────────
-- 1) 立即恢复：所有 processing 状态的行重置为 pending
--    （只要 worker 在跑，正在被处理的也最多 2 分钟内回到 processing；不会丢任务）
-- ──────────────────────────────────────────────
UPDATE thumbnail_scraper_queue
   SET status = 'pending',
       updated_at = now()
 WHERE status = 'processing';

-- ──────────────────────────────────────────────
-- 2) + 3) 重建 dequeue：默认 1，自动回收 stale processing
-- ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS dequeue_thumbnail_scrape(INTEGER);

CREATE OR REPLACE FUNCTION dequeue_thumbnail_scrape(p_limit INTEGER DEFAULT 1)
RETURNS TABLE(
  id UUID,
  transaction_id UUID,
  jan_code TEXT,
  user_id UUID,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE thumbnail_scraper_queue q
     SET status = 'processing',
         attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT inner_q.id
       FROM thumbnail_scraper_queue inner_q
      WHERE inner_q.status = 'pending'
         -- worker 拿了任务但崩溃 / 长时间没完成 → 视为 stale，重新认领
         OR (inner_q.status = 'processing' AND inner_q.updated_at < now() - INTERVAL '2 minutes')
      ORDER BY inner_q.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
  RETURNING q.id, q.transaction_id, q.jan_code, q.user_id, q.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────
-- 4) 监控 view：SELECT * FROM thumbnail_queue_status; 看进度
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW thumbnail_queue_status AS
SELECT status,
       COUNT(*) AS count,
       MIN(created_at) AS oldest,
       MAX(updated_at) AS latest
  FROM thumbnail_scraper_queue
 GROUP BY status
 ORDER BY status;
