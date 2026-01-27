-- 验证触发器是否创建成功
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_recalculate_transaction_profits';

-- 验证函数是否存在
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'recalculate_transaction_profits';
