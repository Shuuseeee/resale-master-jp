// lib/auth-redirect.ts — 登录后回到原来的页面（MCP 授权页等）
// 只接受站内路径，防止被拼成跳到外部网站的开放重定向。

/** 登录后要去的站内路径；不合法时回首页 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('/auth/login')) return '/';
  return raw;
}

/** Google 登录要绕到 Google 再回 /auth/callback，回跳地址用这个 cookie 带过去（几分钟内有效） */
export const NEXT_COOKIE = 'auth_next';
