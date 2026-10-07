import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // 刷新会话（如果过期）
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 定义公开路径（不需要登录）
  const publicPaths = ['/auth/login', '/auth/register', '/auth/callback'];
  const isPublicPath = publicPaths.some((path) => req.nextUrl.pathname.startsWith(path));
  const isApiPath = req.nextUrl.pathname.startsWith('/api/');

  // 如果用户未登录且访问受保护的路径
  if (!session && !isPublicPath && !isApiPath) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/auth/login';
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 如果用户已登录且访问登录/注册页面，重定向到首页
  if (session && isPublicPath) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

// 配置需要运行中间件的路径
export const config = {
  matcher: [
    /*
     * 以下公开静态资源不经过登录校验（不含任何用户数据）：
     * - _next/static、_next/image：Next 构建产物
     * - favicon.ico
     * - sw.js、manifest.webmanifest：PWA 的 Service Worker 与清单。浏览器注册 / 更新 SW 时
     *   不带页面上下文，被重定向到登录页会直接注册失败（Chrome 报 "script is behind a redirect"）
     * - 图片与字体后缀：svg png jpg jpeg gif webp ico、ttf woff woff2。
     *   登录页自己要用 /fonts/*.ttf，未登录时被重定向会导致登录页字体加载不出来
     */
    '/((?!_next/static|_next/image|favicon\\.ico$|sw\\.js$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2)$).*)',
  ],
};
