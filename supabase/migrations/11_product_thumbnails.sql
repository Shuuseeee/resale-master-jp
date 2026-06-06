-- 11_product_thumbnails.sql
-- 商品缩略图自动抓取链路：
--   1) transactions 补 3 列追踪抓取状态
--   2) thumbnail_scraper_queue 队列（结构对齐 kaitorix_scrape_queue）
--   3) 入队 / 原子出队 RPC
--   4) product-images Storage bucket（public）+ owner-scoped 写入策略

-- ──────────────────────────────────────────────
-- 1) transactions 表追踪列
-- ──────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS image_fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_fetch_failed_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_source TEXT
    CHECK (image_source IS NULL OR image_source IN ('manual', 'scraper'));

-- ──────────────────────────────────────────────
-- 2) 抓取队列
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thumbnail_scraper_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  jan_code TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thumb_queue_status
  ON thumbnail_scraper_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_thumb_queue_tx
  ON thumbnail_scraper_queue (transaction_id);

CREATE TRIGGER set_updated_at_thumbnail_scraper_queue
  BEFORE UPDATE ON thumbnail_scraper_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────
-- 3) 去重入队 + 原子出队
-- ──────────────────────────────────────────────
-- 入队：同一 transaction_id 已有 pending/processing 任务则返回旧 id，避免重复抓
CREATE OR REPLACE FUNCTION enqueue_thumbnail_scrape(
  p_transaction_id UUID,
  p_jan_code TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  SELECT id INTO existing_id
  FROM thumbnail_scraper_queue
  WHERE transaction_id = p_transaction_id
    AND status IN ('pending', 'processing')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO thumbnail_scraper_queue (transaction_id, jan_code, user_id, status)
  VALUES (p_transaction_id, p_jan_code, p_user_id, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 原子出队：SELECT ... FOR UPDATE SKIP LOCKED，多 worker 不会抢同一行
CREATE OR REPLACE FUNCTION dequeue_thumbnail_scrape(p_limit INTEGER DEFAULT 5)
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
      ORDER BY inner_q.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
  RETURNING q.id, q.transaction_id, q.jan_code, q.user_id, q.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理已完成/失败超 24h 的记录
CREATE OR REPLACE FUNCTION cleanup_thumbnail_queue()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM thumbnail_scraper_queue
   WHERE status IN ('completed', 'failed')
     AND updated_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────
-- 4) RLS
-- ──────────────────────────────────────────────
ALTER TABLE thumbnail_scraper_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thumbnail_scraper_queue_insert" ON thumbnail_scraper_queue;
DROP POLICY IF EXISTS "thumbnail_scraper_queue_select" ON thumbnail_scraper_queue;

CREATE POLICY "thumbnail_scraper_queue_insert"
  ON thumbnail_scraper_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "thumbnail_scraper_queue_select"
  ON thumbnail_scraper_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 5) Storage: product-images bucket（public read，owner write）
-- 路径规约：{user_id}/{transaction_id}.webp
-- ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_delete" ON storage.objects;

CREATE POLICY "product_images_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- 写入 / 更新 / 删除：路径首段必须是 auth.uid()
-- scraper 用 service_role 操作，service_role 绕过 RLS，所以不影响后台抓取
CREATE POLICY "product_images_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
