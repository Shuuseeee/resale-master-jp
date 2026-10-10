// app/auth/consent/page.tsx — OAuth 授权确认页（Supabase Auth OAuth 2.1 Server 的 Authorization Path）
// AI 客户端（claude.ai 等）添加我们的 MCP 时，Supabase 会把用户带到这里：/auth/consent?authorization_id=...
// 未登录时中间件先送去登录页，登录后带着原地址回来。允许 / 拒绝后跳到 Supabase 返回的 redirect_url。
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { BrandIcon } from '@/components/BrandIcon';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/fluent/Spinner';
import { button } from '@/lib/theme';

interface Details {
  clientName: string;
  clientUri: string;
  email: string;
  scopes: string[];
}

const SCOPE_LABELS: Record<string, string> = {
  openid: '确认你的身份',
  email: '读取你的邮箱地址',
  profile: '读取你的基本资料',
};

function Consent() {
  const params = useSearchParams();
  const authorizationId = params.get('authorization_id');
  const { user } = useAuth();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);

  useEffect(() => {
    if (!authorizationId) {
      setError('缺少授权请求编号，请回到 AI 应用重新连接。');
      return;
    }
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: err }) => {
      if (err || !data) {
        setError(err?.message ?? '授权请求无效或已过期，请回到 AI 应用重新连接。');
        return;
      }
      // 之前已经授权过：Supabase 直接给出回跳地址
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      setDetails({
        clientName: data.client?.name || '未命名应用',
        clientUri: data.client?.uri ?? '',
        email: data.user?.email ?? '',
        scopes: (data.scope ?? '').split(' ').filter(Boolean),
      });
    });
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    if (!authorizationId) return;
    setBusy(approve ? 'approve' : 'deny');
    const { data, error: err } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (err || !data) {
      setBusy(null);
      setError(err?.message ?? '操作失败，请重试。');
      return;
    }
    window.location.href = data.redirect_url;
  };

  const host = (() => {
    try {
      return details?.clientUri ? new URL(details.clientUri).host : '';
    } catch {
      return details?.clientUri ?? '';
    }
  })();

  return (
    <div className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-[var(--shadow-sm)]">
      {error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : !details ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <>
          <div>
            <p className="text-base font-semibold">「{details.clientName}」请求访问你的 Resale Master 账户</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {host && `${host} · `}将以 {details.email || user?.email} 的身份连接
            </p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-medium">它将可以：</p>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>通过 MCP 工具读取你的库存、利润概况和买取店规则</li>
              <li>为你的未售库存计算出货方案（只计算，不修改任何数据）</li>
              {details.scopes.filter(s => SCOPE_LABELS[s]).map(s => (
                <li key={s}>{SCOPE_LABELS[s]}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            以后可以在 AI 应用里断开连接来撤销授权。
          </p>
          <div className="flex gap-3">
            <button type="button" className={button.primary + ' flex-1'} disabled={!!busy} onClick={() => decide(true)}>
              {busy === 'approve' ? '授权中…' : '允许'}
            </button>
            <button type="button" className={button.secondary + ' flex-1'} disabled={!!busy} onClick={() => decide(false)}>
              {busy === 'deny' ? '处理中…' : '拒绝'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ConsentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 text-[var(--color-text)]">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 text-center">
          <BrandIcon className="mx-auto mb-4 h-14 w-14 shadow-[var(--shadow-md)]" />
          <h1 className="text-[24px] font-bold tracking-tight">连接授权</h1>
        </div>
        <Suspense>
          <Consent />
        </Suspense>
      </div>
    </div>
  );
}
