-- Track Kaitorix Open API daily usage locally so expensive manual refreshes
-- can be guarded before calling the official endpoint.
ALTER TABLE kaitorix_price_cache
  ADD COLUMN IF NOT EXISTS raw_response JSONB,
  ADD COLUMN IF NOT EXISTS last_fetch_source TEXT DEFAULT 'scraper'
    CHECK (last_fetch_source IN ('scraper', 'official', 'cache'));

CREATE TABLE IF NOT EXISTS kaitorix_open_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date DATE NOT NULL UNIQUE,
  used_count INTEGER NOT NULL DEFAULT 0,
  last_limit INTEGER NOT NULL DEFAULT 30,
  last_remaining INTEGER,
  last_reset_at TIMESTAMPTZ,
  last_status INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kaitorix_open_api_usage_date
  ON kaitorix_open_api_usage(usage_date);

DROP TRIGGER IF EXISTS set_updated_at_kaitorix_open_api_usage ON kaitorix_open_api_usage;
CREATE TRIGGER set_updated_at_kaitorix_open_api_usage
  BEFORE UPDATE ON kaitorix_open_api_usage
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE kaitorix_open_api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kaitorix_open_api_usage_select_admin" ON kaitorix_open_api_usage;
CREATE POLICY "kaitorix_open_api_usage_select_admin"
  ON kaitorix_open_api_usage FOR SELECT
  TO authenticated
  USING (is_admin());
