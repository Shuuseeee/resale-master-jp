-- 原子出队函数：SELECT ... FOR UPDATE SKIP LOCKED 保证多 worker 不会重复取同一任务
CREATE OR REPLACE FUNCTION dequeue_kaitorix_scrape()
RETURNS TABLE(
  id UUID,
  jan TEXT,
  user_id UUID,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE kaitorix_scrape_queue
  SET status = 'processing', attempts = attempts + 1
  WHERE kaitorix_scrape_queue.id = (
    SELECT q.id
    FROM kaitorix_scrape_queue q
    WHERE q.status = 'pending'
    ORDER BY q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    kaitorix_scrape_queue.id,
    kaitorix_scrape_queue.jan,
    kaitorix_scrape_queue.user_id,
    kaitorix_scrape_queue.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
