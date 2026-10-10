import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { NEXT_COOKIE, safeNext } from '@/lib/auth-redirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    // Google 登录前记下的回跳地址（如 MCP 授权页），用完即删
    const next = safeNext(decodeURIComponent(request.cookies.get(NEXT_COOKIE)?.value ?? ''));
    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.set({ name: NEXT_COOKIE, value: '', path: '/', maxAge: 0 });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  // 出错时跳回登录页
  return NextResponse.redirect(`${origin}/auth/login`);
}
