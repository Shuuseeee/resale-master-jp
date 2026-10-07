-- 交易编辑历史表
CREATE TABLE IF NOT EXISTS transaction_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID       NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID        REFERENCES auth.users(id),
  old_values    JSONB       NOT NULL,
  new_values    JSONB       NOT NULL
);

-- RLS
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own history"
  ON transaction_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own history"
  ON transaction_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 索引
CREATE INDEX idx_transaction_history_tx_id ON transaction_history(transaction_id, changed_at DESC);

-- Trigger: transactions UPDATE 时自动记录变更字段
CREATE OR REPLACE FUNCTION record_transaction_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tracked_fields TEXT[] := ARRAY[
    'product_name','date','purchase_price_total','unit_price','quantity',
    'card_paid','point_paid','balance_paid',
    'expected_platform_points','expected_card_points','extra_platform_points',
    'jan_code','order_number','notes','status','image_url',
    'purchase_platform_id','card_id'
  ];
  old_json JSONB := to_jsonb(OLD);
  new_json JSONB := to_jsonb(NEW);
  old_diff JSONB := '{}'::JSONB;
  new_diff JSONB := '{}'::JSONB;
  field TEXT;
BEGIN
  FOREACH field IN ARRAY tracked_fields LOOP
    IF old_json->field IS DISTINCT FROM new_json->field THEN
      old_diff := old_diff || jsonb_build_object(field, old_json->field);
      new_diff := new_diff || jsonb_build_object(field, new_json->field);
    END IF;
  END LOOP;

  -- 有变更才记录
  IF old_diff <> '{}'::JSONB THEN
    INSERT INTO transaction_history(transaction_id, user_id, old_values, new_values)
    VALUES (NEW.id, auth.uid(), old_diff, new_diff);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_transaction_history
  AFTER UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION record_transaction_change();
