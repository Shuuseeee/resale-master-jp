// app/auth/consent/page.tsx — OAuth 授权确认页（本站自有授权服务器，lib/server/oauth.ts）
// AI 客户端连接 MCP 时，/api/oauth/authorize 校验后把用户送到这里：/auth/consent?request_id=...
// 未登录时中间件先送去登录页，登录后带着原地址回来。允许 / 拒绝后跳到接口返回的客户端回调地址。
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import Spinner from '@/components/fluent/Spinner';
import { button } from '@/lib/theme';

interface Details {
  client_name: string;
  redirect_uri: string;
  email: string;
}

function Consent() {
  const requestId = useSearchParams().get('request_id');
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError('缺少授权请求编号，请回到 AI 应用重新连接。');
      return;
    }
    fetch(`/api/oauth/requests/${encodeURIComponent(requestId)}`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? '授权请求无效');
        setDetails(body);
      })
      .catch(e => setError(e.message));
  }, [requestId]);

  const decide = async (approve: boolean) => {
    if (!requestId) return;
    setBusy(approve ? 'approve' : 'deny');
    try {
      const r = await fetch(`/api/oauth/requests/${encodeURIComponent(requestId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approve }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? '操作失败');
      window.location.href = body.redirect_url;
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : '操作失败，请重试。');
    }
  };

  const host = (() => {
    try {
      return details ? new URL(details.redirect_uri).host || details.redirect_uri : '';
    } catch {
      return details?.redirect_uri ?? '';
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
            <p className="text-base font-semibold">「{details.client_name}」请求连接你的 Resale Master 账户</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">以 {details.email} 的身份连接</p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-stat)] px-3 py-2 text-sm">
            授权后将返回：<span className="font-semibold">{host}</span>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">请确认这是你正在使用的 AI 应用的网址（例如 claude.ai）。不认识就点「拒绝」。</p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-medium">它将可以：</p>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>读取你的库存、利润概况、交易明细（含出售 / 退货）和买取店规则</li>
              <li>为你的未售库存计算出货方案</li>
            </ul>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">只能查询和计算，不能修改或删除任何数据。</p>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">以后可以在「设置 › 已连接的 AI」随时撤销。</p>
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
