// components/settings/ConnectedAppsSection.tsx — 设置「已连接的 AI」：通过 MCP 授权过的 AI 应用，可撤销
// 数据来自 /api/oauth/grants（本站 OAuth 服务器的令牌，见 lib/server/oauth.ts）。撤销 = 作废该应用的全部令牌，下次使用要重新授权。
'use client';

import { useCallback, useEffect, useState } from 'react';
import { card } from '@/lib/theme';
import Spinner from '@/components/fluent/Spinner';
import { ConfirmModal } from '@/components/Modal';
import CopyButton from '@/components/CopyButton';

interface Grant {
  client_id: string;
  client_name: string;
  redirect_host: string;
  connected_at: string;
  last_used_at: string | null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }) : '未使用');

export default function ConnectedAppsSection() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const [origin, setOrigin] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/oauth/grants');
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? '读取失败');
      setGrants(body);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败');
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const revoke = async () => {
    if (!revoking) return;
    await fetch(`/api/oauth/grants?client_id=${encodeURIComponent(revoking.client_id)}`, { method: 'DELETE' });
    setRevoking(null);
    load();
  };

  return (
    <section className={card.primary + ' p-6'}>
      <h2 className="text-xl font-bold text-[var(--color-text)]">已连接的 AI</h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        在 claude.ai 等支持 MCP 的 AI 里添加连接器（地址{' '}
        <CopyButton text={`${origin}/api/mcp/mcp`} label="复制 MCP 地址">
          {origin}/api/mcp/mcp
        </CopyButton>）， 登录并点「允许」后会出现在这里。AI 只能查询库存 / 利润 / 交易明细 / 店铺规则和计算出货方案，不能修改数据。
      </p>
      <div className="mt-5">
        {error ? (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        ) : !grants ? (
          <Spinner />
        ) : grants.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">还没有连接任何 AI。</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {grants.map(g => (
              <li key={g.client_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--color-text)]">{g.client_name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {g.redirect_host} · 连接于 {fmt(g.connected_at)} · 最近使用 {fmt(g.last_used_at)}
                  </p>
                </div>
                <button type="button" className="fluent-btn fluent-btn--default shrink-0" onClick={() => setRevoking(g)}>
                  撤销
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmModal
        isOpen={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="撤销授权"
        message={`撤销后「${revoking?.client_name ?? ''}」将无法再读取你的数据，下次使用需要重新授权。`}
        confirmText="撤销"
        confirmVariant="danger"
      />
    </section>
  );
}
