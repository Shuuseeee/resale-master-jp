'use client';

// 设置页「支付方式」区块：信用卡列表 + 新增 / 编辑 / 删除弹窗。
// 原先是独立页面 /settings/payment-methods（该地址现由 next.config.js 跳转到 /settings#payment-methods）。

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, PointsPlatform } from '@/types/database.types';
import { badge, button, card } from '@/lib/theme';
import { formatPointRate } from '@/lib/utils/paymentMethods';
import PaymentMethodDialog from '@/components/PaymentMethodDialog';
import { getDefaultPaymentMethodId, saveDefaultPaymentMethodId } from '@/lib/api/user-preferences';

export default function PaymentMethodsSection() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  // 新增 / 编辑弹窗：editing 为 null 表示新增
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  // 默认卡（新建交易时自动选中）；存在 user_preferences，跨设备同步
  const [defaultId, setDefaultId] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
    getDefaultPaymentMethodId().then(setDefaultId);
    supabase.from('points_platforms').select('*').eq('is_active', true).order('display_name')
      .then(({ data }) => setPointsPlatforms(data || []));
  }, []);

  // 从旧地址 /settings/payment-methods 跳转过来时带 #payment-methods：设置页先显示加载骨架，
  // 浏览器按锚点滚动时本区块还没渲染出来，所以等列表加载完再自己滚到这里
  useEffect(() => {
    if (!loading && window.location.hash === '#payment-methods') {
      document.getElementById('payment-methods')?.scrollIntoView({ block: 'start' });
    }
  }, [loading]);

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

  const openDialog = (method: PaymentMethod | null) => {
    setEditing(method);
    setDialogOpen(true);
  };

  // 保存后原地更新列表（不重新加载，避免闪出加载态）
  const handleSaved = (saved: PaymentMethod) => {
    if (!saved.is_active && saved.id === defaultId) void setDefault(null);
    setPaymentMethods(methods => {
      const exists = methods.some(m => m.id === saved.id);
      const next = exists ? methods.map(m => (m.id === saved.id ? saved : m)) : [...methods, saved];
      return next.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    });
    setDialogOpen(false);
  };

  const handleDeleted = (id: string) => {
    setPaymentMethods(methods => methods.filter(m => m.id !== id));
    // 数据库外键 ON DELETE SET NULL 已清掉默认卡，这里同步本地状态
    if (id === defaultId) setDefaultId(null);
    setDialogOpen(false);
  };

  const setDefault = async (id: string | null) => {
    const { error } = await saveDefaultPaymentMethodId(id);
    if (error) {
      console.error('设置默认卡失败:', error);
      alert('设置默认卡失败，请重试');
      return false;
    }
    setDefaultId(id);
    return true;
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
      // 停用的卡不能再是默认卡
      if (isActive && id === defaultId) void setDefault(null);
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  };

  const cardMethods = paymentMethods.filter(pm => pm.type === 'card');

  const statusBadge = (method: PaymentMethod) => (
    <button
      type="button"
      onClick={() => toggleActive(method.id, method.is_active)}
      title="点击切换启用 / 停用"
      className={method.is_active ? badge.success : badge.neutral}
    >
      {method.is_active ? '启用' : '停用'}
    </button>
  );

  // 默认卡标记 / 操作：只有启用中的卡能设为默认
  const defaultControl = (method: PaymentMethod) => {
    if (method.id === defaultId) {
      return (
        <span className="inline-flex items-center gap-2">
          <span className={badge.info}>默认</span>
          <button type="button" onClick={() => setDefault(null)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            取消
          </button>
        </span>
      );
    }
    if (!method.is_active) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
    return (
      <button type="button" onClick={() => setDefault(method.id)} className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
        设为默认
      </button>
    );
  };

  return (
    <section id="payment-methods" className={card.primary + ' scroll-mt-24 p-6 lg:col-span-2'}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
            支付方式
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            新建交易时选择的信用卡；返点率用于自动计算卡积分。新建交易填写「信用卡支付」金额时会自动选中默认卡。停用的卡不会出现在新交易里，历史交易不受影响。
          </p>
        </div>
        <button type="button" onClick={() => openDialog(null)} className={`${button.secondary} flex-shrink-0 gap-2`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加支付方式
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">加载中...</div>
      ) : cardMethods.length === 0 ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] py-6 text-center text-sm text-[var(--color-text-muted)]">
          还没有支付方式，点击「添加支付方式」新建。
        </div>
      ) : (
        <>
          {/* 手机：一行一张卡 */}
          <div className="space-y-2 md:hidden">
            {cardMethods.map(method => (
              <div key={method.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--color-text)]">{method.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>返点率 <span className="font-semibold text-[var(--color-primary)]">{formatPointRate(method.point_rate)}</span></span>
                    {defaultControl(method)}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {statusBadge(method)}
                  <button type="button" onClick={() => openDialog(method)} className={button.link}>
                    编辑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 桌面：表格 */}
          <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] md:block">
            <table className="w-full">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr className="border-b border-[var(--color-border)]">
                  {['名称', '返点率', '状态', '默认卡', '操作'].map(label => (
                    <th key={label} className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] first:text-left">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {cardMethods.map(method => (
                  <tr key={method.id} className="transition-colors hover:bg-[var(--color-bg-subtle)]">
                    <td className="px-5 py-3 text-sm font-semibold text-[var(--color-text)]">{method.name}</td>
                    <td className="px-5 py-3 text-center text-sm font-semibold text-[var(--color-primary)]">
                      {formatPointRate(method.point_rate)}
                    </td>
                    <td className="px-5 py-3 text-center">{statusBadge(method)}</td>
                    <td className="px-5 py-3 text-center">{defaultControl(method)}</td>
                    <td className="px-5 py-3 text-center">
                      <button type="button" onClick={() => openDialog(method)} className={button.link}>
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PaymentMethodDialog
        isOpen={dialogOpen}
        method={editing}
        pointsPlatforms={pointsPlatforms}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </section>
  );
}
