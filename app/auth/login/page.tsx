'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('邮箱尚未验证，请前往邮箱点击验证链接后再登录。');
        } else if (error.message.includes('Invalid login credentials')) {
          setError('邮箱或密码错误，请重新输入。');
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-apple-bg dark:bg-apple-bgDark px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-apple-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-card">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold text-gray-900 dark:text-white tracking-tight">
            Resale Master JP
          </h1>
          <p className="mt-1 text-[15px] text-apple-gray-1">转卖账务管理系统</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-apple-cardDark rounded-2xl shadow-card p-6 space-y-5">
          {/* Google Login */}
          <button
            type="button"
            onClick={async () => {
              setGoogleLoading(true);
              const { error } = await signInWithGoogle();
              if (error) { setError(error.message); setGoogleLoading(false); }
            }}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-[10px] bg-apple-gray-5 dark:bg-white/10 text-[15px] font-semibold text-gray-900 dark:text-white active:opacity-70 transition-opacity disabled:opacity-40"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? '跳转中...' : '使用 Google 账号登录'}
          </button>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-apple-separator dark:bg-apple-sepDark" />
            <span className="text-[13px] text-apple-gray-1">或使用邮箱登录</span>
            <div className="flex-1 h-px bg-apple-separator dark:bg-apple-sepDark" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-apple-red/10 text-apple-red px-4 py-3 rounded-xl text-[14px]">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-[15px] bg-apple-gray-6 dark:bg-white/8 border-0 rounded-[10px] text-gray-900 dark:text-white placeholder-apple-gray-1 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-shadow"
                placeholder="邮箱地址"
              />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-[15px] bg-apple-gray-6 dark:bg-white/8 border-0 rounded-[10px] text-gray-900 dark:text-white placeholder-apple-gray-1 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-shadow"
                placeholder="密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-apple-blue text-white rounded-[10px] text-[15px] font-semibold active:opacity-70 transition-opacity disabled:opacity-40"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center text-[14px] text-apple-gray-1">
            还没有账户？{' '}
            <Link href="/auth/register" className="text-apple-blue font-medium active:opacity-70 transition-opacity">
              立即注册
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[13px] text-apple-gray-2">需要使用受邀账户登录</p>
      </div>
    </div>
  );
}
