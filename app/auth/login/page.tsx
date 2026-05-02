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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)]">
      <div className="w-full max-w-[380px]">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-primary)] to-[#059669] shadow-[var(--shadow-md)]">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-text)]">
            Resale Master JP
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">转卖账务管理系统</p>
        </div>

        {/* Card */}
        <div className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-[var(--shadow-sm)]">
          {/* Google Login */}
          <button
            type="button"
            onClick={async () => {
              setGoogleLoading(true);
              const { error } = await signInWithGoogle();
              if (error) { setError(error.message); setGoogleLoading(false); }
            }}
            disabled={googleLoading}
            className="flex min-h-[42px] w-full items-center justify-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-all hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
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
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)]">或使用邮箱登录</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-[var(--radius-md)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
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
                className="sn-form-input"
                placeholder="邮箱地址"
              />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="sn-form-input"
                placeholder="密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[#059669] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-inverted)] transition-all hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center text-sm text-[var(--color-text-muted)]">
            还没有账户？{' '}
            <Link href="/auth/register" className="font-medium text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-hover)]">
              立即注册
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">需要使用受邀账户登录</p>
      </div>
    </div>
  );
}
