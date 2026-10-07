'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { clearOfflineCache } from '@/lib/offline/persister';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  // 登出 / 会话被撤销：财务数据不能留在设备上。先清内存缓存，再清 IndexedDB
  // （顺序有意：先 queryClient.clear 让后续缓存事件序列化出空数据，避免旧数据被重新写入）
  const clearLocalData = async () => {
    queryClient.clear();
    await clearOfflineCache();
  };

  useEffect(() => {
    // 检查当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 仅 SIGNED_OUT 才是「确定登出」；INITIAL_SESSION 为 null 在离线且 token 过期时也会出现，不能据此清缓存
      if (event === 'SIGNED_OUT') void clearLocalData();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      setSession(data.session);
      setUser(data.user);

      // 等待一小段时间确保 session 被存储到 cookies
      await new Promise(resolve => setTimeout(resolve, 100));

      // 使用 window.location 而不是 router.push 来确保完整的页面刷新
      window.location.href = '/';

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error };
      }

      if (data.user && data.session) {
        // 邮箱验证已关闭：直接登录
        setSession(data.session);
        setUser(data.user);
        await new Promise(resolve => setTimeout(resolve, 100));
        window.location.href = '/';
      }
      // 邮箱验证已开启：data.session 为 null，需要用户去邮箱点击验证链接
      // 返回 error: null 让注册页显示「验证邮件已发送」提示

      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as AuthError };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error) return { error };
      if (data.url) {
        window.location.href = data.url;
      }
      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      // 先清本地数据再登出：登出后会整页跳转，异步清库可能被中断
      await clearLocalData();
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      // 使用 window.location.href 确保完整刷新，特别是在 iOS 上
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Sign out error:', error);
      // 即使出错也强制跳转到登录页
      window.location.href = '/auth/login';
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
