-- Migration 06: KaitoriX price cache + scrape queue
-- 用于本地 Playwright RPA 爬虫架构

-- 1. 价格缓存表（共享，无 user_id）
CREATE TABLE IF NOT EXISTS kaitorix_price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jan TEXT NOT NULL UNIQUE,
  product_name TEXT,
  max_price INTEGER DEFAULT 0,
  max_store TEXT,
  prices JSONB DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 抓取队列表
CREATE TABLE IF NOT EXISTS kaitorix_scrape_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jan TEXT NOT NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_queue_status ON kaitorix_scrape_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_scrape_queue_jan ON kaitorix_scrape_queue(jan);
CREATE INDEX IF NOT EXISTS idx_price_cache_jan ON kaitorix_price_cache(jan);

-- 3. updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_kaitorix_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kaitorix_price_cache_updated
  BEFORE UPDATE ON kaitorix_price_cache
  FOR EACH ROW EXECUTE FUNCTION update_kaitorix_updated_at();

CREATE TRIGGER trg_kaitorix_scrape_queue_updated
  BEFORE UPDATE ON kaitorix_scrape_queue
  FOR EACH ROW EXECUTE FUNCTION update_kaitorix_updated_at();

-- 4. 去重入队函数
CREATE OR REPLACE FUNCTION enqueue_kaitorix_scrape(p_jan TEXT, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  -- 检查是否已有 pending/processing 的同 JAN 任务
  SELECT id INTO existing_id
  FROM kaitorix_scrape_queue
  WHERE jan = p_jan AND status IN ('pending', 'processing')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO kaitorix_scrape_queue (jan, user_id, status)
  VALUES (p_jan, p_user_id, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 清理旧队列记录
CREATE OR REPLACE FUNCTION cleanup_kaitorix_queue()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM kaitorix_scrape_queue
  WHERE status IN ('completed', 'failed')
    AND updated_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS
ALTER TABLE kaitorix_price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaitorix_scrape_queue ENABLE ROW LEVEL SECURITY;

-- price_cache: authenticated 可读
CREATE POLICY "kaitorix_price_cache_select"
  ON kaitorix_price_cache FOR SELECT
  TO authenticated
  USING (true);

-- scrape_queue: 用户可插入自己的记录
CREATE POLICY "kaitorix_scrape_queue_insert"
  ON kaitorix_scrape_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- scrape_queue: 用户可查看自己的记录
CREATE POLICY "kaitorix_scrape_queue_select"
  ON kaitorix_scrape_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
