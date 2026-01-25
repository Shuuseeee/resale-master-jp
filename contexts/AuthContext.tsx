'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

      console.log('Sign in successful:', {
        hasUser: !!data.user,
        hasSession: !!data.session,
        userId: data.user?.id,
        userEmail: data.user?.email,
      });

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
          // 禁用邮箱验证（个人使用）
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        return { error };
      }

      // 注册后自动登录
      if (data.user && data.session) {
        setSession(data.session);
        setUser(data.user);

        // 等待一小段时间确保 session 被存储到 cookies
        await new Promise(resolve => setTimeout(resolve, 100));

        // 使用 window.location 而不是 router.push 来确保完整的页面刷新
        window.location.href = '/';
      } else if (data.user && !data.session) {
        // 如果邮箱验证已启用，用户已创建但没有 session
        // 返回一个特殊错误提示用户需要先禁用邮箱验证
        return {
          error: {
            message: '请先在 Supabase Dashboard 中禁用邮箱验证功能。访问 Authentication → Settings → Email Auth，取消选中 "Enable email confirmations"',
            name: 'EmailConfirmationRequired',
            status: 400
          } as AuthError
        };
      }

      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
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
