// app/settings/payment-methods/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, PointsPlatform } from '@/types/database.types';
import { badge, button, card, heading, layout } from '@/lib/theme';
import { formatPointRate } from '@/lib/utils/paymentMethods';
import PaymentMethodDialog from '@/components/PaymentMethodDialog';

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  // 新增 / 编辑弹窗：editing 为 null 表示新增
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    loadPaymentMethods();
    supabase.from('points_platforms').select('*').eq('is_active', true).order('display_name')
      .then(({ data }) => setPointsPlatforms(data || []));
  }, []);

  const openDialog = (method: PaymentMethod | null) => {
    setEditing(method);
    setDialogOpen(true);
  };

  // 保存后原地更新列表（不整页重新加载，避免闪出加载态）
  const handleSaved = (saved: PaymentMethod) => {
    setPaymentMethods(methods => {
      const exists = methods.some(m => m.id === saved.id);
      const next = exists ? methods.map(m => (m.id === saved.id ? saved : m)) : [...methods, saved];
      return next.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    });
    setDialogOpen(false);
  };

  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('type')
        .order('name');

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('加载支付方式失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setPaymentMethods(methods =>
        methods.map(m => m.id === id ? { ...m, is_active: !isActive } : m)
      );
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  };

  const cardMethods = paymentMethods.filter(pm => pm.type === 'card');

  if (loading) {
    return (
      <div className={layout.page}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--color-text)]">
            <svg className="h-7 w-7 animate-spin text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <div className="mb-6">
          <Link
            href="/settings"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回设置
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className={heading.h1}>支付方式管理</h1>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">配置返点率和启用状态。</p>
            </div>
            <button type="button" onClick={() => openDialog(null)} className={`${button.primary} gap-2`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加支付方式
            </button>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[var(--color-text)]">
            信用卡配置
          </h2>

          <div className="space-y-3 md:hidden">
            {cardMethods.map(method => (
              <div key={method.id} className={card.primary + ' p-4'}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--color-text)]">{method.name}</h3>
                  <button
                    onClick={() => toggleActive(method.id, method.is_active)}
                    className={method.is_active ? badge.success : badge.neutral}
                  >
                    {method.is_active ? '启用' : '禁用'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="text-xs text-[var(--color-text-muted)]">返点率</div>
                    <div className="mt-1 font-semibold text-[var(--color-primary)]">{formatPointRate(method.point_rate)}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <button type="button" onClick={() => openDialog(method)} className={button.link}>
                    编辑
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={card.primary + ' hidden overflow-hidden md:block'}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-bg-subtle)]">
                  <tr className="border-b border-[var(--color-border)]">
                    {['名称', '返点率', '状态', '操作'].map(label => (
                      <th key={label} className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] first:text-left">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {cardMethods.map(method => (
                    <tr key={method.id} className="transition-colors hover:bg-[var(--color-bg-subtle)]">
                      <td className="px-5 py-4 text-sm font-semibold text-[var(--color-text)]">{method.name}</td>
                      <td className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-primary)]">
                        {formatPointRate(method.point_rate)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => toggleActive(method.id, method.is_active)}
                          className={method.is_active ? badge.success : badge.neutral}
                        >
                          {method.is_active ? '启用' : '禁用'}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button type="button" onClick={() => openDialog(method)} className={button.link}>
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <PaymentMethodDialog
        isOpen={dialogOpen}
        method={editing}
        pointsPlatforms={pointsPlatforms}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
