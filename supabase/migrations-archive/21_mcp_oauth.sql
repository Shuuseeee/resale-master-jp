-- 21_mcp_oauth.sql（2026-10-11）
-- 自有 OAuth 2.1 授权服务器（给 MCP 用，设计参考 Trek，代码自写）：客户端登记 / 待确认的授权请求 / 授权码 / 令牌。
-- 令牌只对本应用的 MCP 有效（只读工具），拿不到 Supabase 的数据接口。令牌、授权码、客户端密钥只存 SHA-256 哈希。
-- 四张表都开 RLS 且不建策略：只有服务端（service role）能读写。可重复执行。

CREATE TABLE IF NOT EXISTS public.oauth_clients (
  id text NOT NULL,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  token_endpoint_auth_method text DEFAULT 'none' NOT NULL,
  client_secret_hash text,
  created_ip text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT oauth_clients_pkey PRIMARY KEY (id),
  CONSTRAINT oauth_clients_auth_method_check CHECK (token_endpoint_auth_method IN ('none', 'client_secret_post', 'client_secret_basic'))
);

CREATE TABLE IF NOT EXISTS public.oauth_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id text NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text NOT NULL,
  state text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT oauth_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.oauth_codes (
  code_hash text NOT NULL,
  client_id text NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  CONSTRAINT oauth_codes_pkey PRIMARY KEY (code_hash)
);

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  token_hash text NOT NULL,
  kind text NOT NULL,
  client_id text NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT oauth_tokens_pkey PRIMARY KEY (token_hash),
  CONSTRAINT oauth_tokens_kind_check CHECK (kind IN ('access', 'refresh'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON public.oauth_tokens (user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_created ON public.oauth_clients (created_ip, created_at);

ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_clients, public.oauth_requests, public.oauth_codes, public.oauth_tokens FROM anon, authenticated;
