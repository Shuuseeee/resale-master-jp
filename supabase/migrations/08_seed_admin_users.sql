-- ============================================
-- 08: Seed initial admin users
-- ============================================
INSERT INTO public.user_roles (user_id, role) VALUES
  ('75c7986b-7678-4de3-a50b-33e0a9f730cc', 'admin'),
  ('f43a7347-e56f-4834-a5f0-c91b1225e77d', 'admin')
ON CONFLICT DO NOTHING;
