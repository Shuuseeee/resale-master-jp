-- 12_batch_enqueue_thumbnails.sql
-- 批量入队助手：把所有"有 JAN 但没图"的 transactions 一次性扔进 thumbnail_scraper_queue
-- 已 dedup —— 已经 pending/processing 的不会重复加；失败超 5 次的跳过
--
-- 用法（Supabase Dashboard → SQL Editor 或 psql）：
--   SELECT batch_enqueue_thumbnails();                          -- 所有用户的所有缺图交易
--   SELECT batch_enqueue_thumbnails('xxxxxxxx-...-...');        -- 限定某个 user_id
--
-- 返回值：本次新入队的条数（不含被 dedup 跳过的）
--
-- 若想强制重抓某些已有图的交易（比如想用新的 pad-to-square 策略重做老图），
-- 先清掉它们的 image_url 再调本函数：
--   UPDATE transactions
--      SET image_url = NULL, image_fetched_at = NULL, image_fetch_failed_count = 0
--    WHERE id IN ('...');
--   SELECT batch_enqueue_thumbnails();

CREATE OR REPLACE FUNCTION batch_enqueue_thumbnails(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO thumbnail_scraper_queue (transaction_id, jan_code, user_id, status)
  SELECT t.id, t.jan_code, t.user_id, 'pending'
    FROM transactions t
   WHERE t.jan_code IS NOT NULL
     AND t.jan_code ~ '^\d{8,13}$'
     AND t.image_url IS NULL
     AND t.image_fetch_failed_count < 5
     AND (p_user_id IS NULL OR t.user_id = p_user_id)
     AND NOT EXISTS (
       SELECT 1 FROM thumbnail_scraper_queue q
        WHERE q.transaction_id = t.id
          AND q.status IN ('pending', 'processing')
     );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
