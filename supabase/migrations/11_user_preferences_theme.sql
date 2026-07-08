-- 11_user_preferences_theme.sql
-- 用户配色主题（data-palette 轴，见 lib/themes.ts）跨设备同步
-- ⚠️ 需手动 apply 到 Supabase Dashboard SQL Editor 或 supabase db push
--    上线前未执行时 saveThemePalette 静默失败，仅本机 localStorage 生效

alter table public.user_preferences add column theme_palette text;
