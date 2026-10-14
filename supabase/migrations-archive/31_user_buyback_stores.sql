-- 31_user_buyback_stores.sql（2026-10-14）
-- 「设置 > 买取价格检查」勾选的买取店存进数据库：之前只在浏览器 localStorage，换设备要重设，
-- MCP 的 plan_shipment 也读不到（会用没勾的店排方案）。NULL = 没设置过 = 全部店。可重复执行。
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS buyback_stores text[];
