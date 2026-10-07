-- 14_jan_thumbnail_cache.sql
-- 重构：缩略图从 (user_id, transaction_id) 维度改成 JAN 维度（对齐 kaitorix_price_cache 的共享模式）
--   - 同一 JAN 全站只抓一次、只存一份、所有用户共享
--   - transactions.image_url 含义收窄为"用户手动上传的凭证/覆盖图"
--   - 显示时优先 manual，否则按 jan_code fall back 到 jan_thumbnail_cache
--
-- 变更：
--   1) 建 jan_thumbnail_cache（jan PK）+ jan_thumbnail_queue（jan 维度，无 user/tx）
--   2) 新 RPC：enqueue_jan_thumbnail / dequeue_jan_thumbnail / batch_enqueue_jan_thumbnails / cleanup
--   3) DROP 老的 thumbnail_scraper_queue 及其函数、监控 view
--   4) DROP transactions 的 image_fetched_at / image_fetch_failed_count / image_source
--   5) product-images bucket 改 service-role 写、public 读（不再 user-folder）

-- ──────────────────────────────────────────────
-- 1) 清理旧的 transaction 维度实现
-- ──────────────────────────────────────────────
DROP VIEW IF EXISTS thumbnail_queue_status;
DROP FUNCTION IF EXISTS enqueue_thumbnail_scrape(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS dequeue_thumbnail_scrape(INTEGER);
DROP FUNCTION IF EXISTS cleanup_thumbnail_queue();
DROP FUNCTION IF EXISTS batch_enqueue_thumbnails(UUID);
DROP TABLE IF EXISTS thumbnail_scraper_queue;

ALTER TABLE transactions
  DROP COLUMN IF EXISTS image_fetched_at,
  DROP COLUMN IF EXISTS image_fetch_failed_count,
  DROP COLUMN IF EXISTS image_source;

-- ──────────────────────────────────────────────
-- 2) JAN 维度缓存表
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jan_thumbnail_cache (
  jan TEXT PRIMARY KEY,
  image_url TEXT,
  image_fetched_at TIMESTAMPTZ,
  image_fetch_failed_count SMALLINT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at_jan_thumbnail_cache
  BEFORE UPDATE ON jan_thumbnail_cache
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────
-- 3) JAN 维度抓取队列（无 user_id / transaction_id）
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jan_thumbnail_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jan_thumb_queue_status
  ON jan_thumbnail_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jan_thumb_queue_jan
  ON jan_thumbnail_queue (jan);

CREATE TRIGGER set_updated_at_jan_thumbnail_queue
  BEFORE UPDATE ON jan_thumbnail_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────
-- 4) RPC
-- ──────────────────────────────────────────────
-- 去重入队：同一 JAN 已有 pending/processing，或已成功缓存，则不重复入队
CREATE OR REPLACE FUNCTION enqueue_jan_thumbnail(p_jan TEXT)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  -- 已经有图就不入队
  IF EXISTS (SELECT 1 FROM jan_thumbnail_cache c WHERE c.jan = p_jan AND c.image_url IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO existing_id
    FROM jan_thumbnail_queue
   WHERE jan = p_jan AND status IN ('pending', 'processing')
   LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO jan_thumbnail_queue (jan, status)
  VALUES (p_jan, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 原子出队：default 1；自动回收 stale processing（worker 崩溃保护）
CREATE OR REPLACE FUNCTION dequeue_jan_thumbnail(p_limit INTEGER DEFAULT 1)
RETURNS TABLE(id UUID, jan TEXT, attempts INTEGER) AS $$
BEGIN
  RETURN QUERY
  UPDATE jan_thumbnail_queue q
     SET status = 'processing',
         attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT inner_q.id
       FROM jan_thumbnail_queue inner_q
      WHERE inner_q.status = 'pending'
         OR (inner_q.status = 'processing' AND inner_q.updated_at < now() - INTERVAL '2 minutes')
      ORDER BY inner_q.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
  RETURNING q.id, q.jan, q.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量入队：从 transactions 取所有 distinct JAN，跳过已缓存 / 失败超阈值 / 已在队列的
CREATE OR REPLACE FUNCTION batch_enqueue_jan_thumbnails()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO jan_thumbnail_queue (jan, status)
  SELECT DISTINCT t.jan_code, 'pending'
    FROM transactions t
   WHERE t.jan_code ~ '^\d{8,13}$'
     AND NOT EXISTS (
       SELECT 1 FROM jan_thumbnail_cache c
        WHERE c.jan = t.jan_code
          AND (c.image_url IS NOT NULL OR c.image_fetch_failed_count >= 5)
     )
     AND NOT EXISTS (
       SELECT 1 FROM jan_thumbnail_queue q
        WHERE q.jan = t.jan_code AND q.status IN ('pending', 'processing')
     );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理已完成/失败超 24h 的队列行
CREATE OR REPLACE FUNCTION cleanup_jan_thumbnail_queue()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM jan_thumbnail_queue
   WHERE status IN ('completed', 'failed')
     AND updated_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────
-- 5) 监控 view
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW jan_thumbnail_queue_status AS
SELECT status, COUNT(*) AS count,
       MIN(created_at) AS oldest, MAX(updated_at) AS latest
  FROM jan_thumbnail_queue
 GROUP BY status
 ORDER BY status;

-- ──────────────────────────────────────────────
-- 6) RLS：cache / queue 全站共享，任意登录用户可读；写由 service_role（scraper）和 SECURITY DEFINER RPC 完成
-- ──────────────────────────────────────────────
ALTER TABLE jan_thumbnail_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE jan_thumbnail_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jan_thumbnail_cache_select" ON jan_thumbnail_cache;
CREATE POLICY "jan_thumbnail_cache_select"
  ON jan_thumbnail_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jan_thumbnail_queue_select" ON jan_thumbnail_queue;
CREATE POLICY "jan_thumbnail_queue_select"
  ON jan_thumbnail_queue FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 7) product-images bucket：改成 service-role 写、public 读
--    （路径变成 {jan}.webp，不再 user-folder，故撤销原来的 owner 写策略）
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "product_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_delete" ON storage.objects;
-- product_images_public_select 保留（public 读）；写入只剩 service_role（绕过 RLS）
