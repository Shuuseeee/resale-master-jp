-- 将现有数据分配给指定用户
-- 目标用户: syuletyoucryjp@gmail.com

-- 首先创建一个临时函数来获取用户ID
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- 获取目标用户的ID
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'syuletyoucryjp@gmail.com';

  -- 如果用户不存在，抛出错误
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION '用户 syuletyoucryjp@gmail.com 不存在，请先创建该账户';
  END IF;

  -- 更新 bank_accounts 表
  UPDATE bank_accounts
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- 更新 payment_methods 表
  UPDATE payment_methods
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- 更新 transactions 表
  UPDATE transactions
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- 更新 coupons 表
  UPDATE coupons
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- 输出更新结果
  RAISE NOTICE '数据已成功分配给用户: %', target_user_id;
END $$;
