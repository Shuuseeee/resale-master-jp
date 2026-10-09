'use client';

// 支付方式的新增 / 编辑弹窗（设置 → 支付方式管理页内使用，取代原先的两个独立页面）。
// 字段：名称、返点率、信用卡积分平台、启用状态（开关）。有未保存修改时关闭会二次确认。

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, PointsPlatform } from '@/types/database.types';
import Modal, { ConfirmModal, UNSAVED_CHANGES_CONFIRM } from '@/components/Modal';
import Select from '@/components/Select';
import Switch from '@/components/Switch';
import { button, input } from '@/lib/theme';
import { useModalCloseGuard } from '@/hooks/useModalCloseGuard';
import { percentToPointRate, pointRateToPercent } from '@/lib/utils/paymentMethods';

interface FormState {
  name: string;
  point_rate: string; // 百分数，如 "1.5"
  card_points_platform_id: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = { name: '', point_rate: '1', card_points_platform_id: '', is_active: true };

function formFromMethod(method: PaymentMethod | null): FormState {
  if (!method) return EMPTY_FORM;
  return {
    name: method.name,
    point_rate: pointRateToPercent(method.point_rate).toString(),
    card_points_platform_id: method.card_points_platform_id || '',
    is_active: method.is_active,
  };
}

interface PaymentMethodDialogProps {
  isOpen: boolean;
  /** null = 新增 */
  method: PaymentMethod | null;
  pointsPlatforms: PointsPlatform[];
  onClose: () => void;
  onSaved: (method: PaymentMethod) => void;
}

export default function PaymentMethodDialog({ isOpen, method, pointsPlatforms, onClose, onSaved }: PaymentMethodDialogProps) {
  const initial = useMemo(() => formFromMethod(method), [method]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useModalCloseGuard(onClose);
  const { setIsDirty } = guard;

  // 每次打开时用当前卡（或空表单）重置
  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setError(null);
    }
  }, [isOpen, initial]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initial));
  }, [form, initial, setIsDirty]);

  const update = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const percent = parseFloat(form.point_rate);
    if (!name) { setError('请填写名称'); return; }
    if (!Number.isFinite(percent) || percent < 0) { setError('返点率请填写 0 或以上的数字'); return; }

    setSaving(true);
    setError(null);
    const payload = {
      name,
      point_rate: percentToPointRate(percent),
      card_points_platform_id: form.card_points_platform_id || null,
      is_active: form.is_active,
    };
    // 还款周期三列（closing_day / payment_day / payment_same_month）不提交：web 不再管理，原生仍在用，不能覆盖
    const { data, error: saveError } = method
      ? await supabase.from('payment_methods').update(payload).eq('id', method.id).select('*').single()
      : await supabase.from('payment_methods').insert([{ ...payload, type: 'card' }]).select('*').single();
    setSaving(false);

    if (saveError || !data) {
      setError(saveError?.message || '保存失败，请重试');
      return;
    }
    setIsDirty(false);
    onSaved(data as PaymentMethod);
  };

  const field = input.base + ' w-full';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={guard.doClose}
        beforeClose={guard.handleCloseRequest}
        closeOnEsc={!guard.showConfirm}
        closeOnOverlayClick={!guard.showConfirm}
        title={method ? '编辑支付方式' : '添加支付方式'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="sn-form-label">名称 <span className="text-[var(--color-danger)]">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => update({ name: e.target.value })}
              className={field}
              placeholder="例如：楽天カード"
              autoFocus={!method}
            />
          </div>

          <div>
            <label className="sn-form-label">返点率 (%)</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.point_rate}
              onChange={e => update({ point_rate: e.target.value })}
              step="0.01"
              min="0"
              className={field}
            />
            <p className="sn-form-muted">新建交易时按「信用卡支付金额 × 返点率」自动计算卡积分；1% 填 1。</p>
          </div>

          <div>
            <label className="sn-form-label">信用卡积分平台</label>
            <Select
              value={form.card_points_platform_id}
              onChange={v => update({ card_points_platform_id: v })}
              options={pointsPlatforms.map(p => ({ value: p.id, label: p.display_name }))}
              placeholder="未设置"
              clearable
              className={field}
            />
            <p className="sn-form-muted">新建交易时自动关联此积分平台。</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-[var(--color-text)]">{form.is_active ? '已启用' : '已停用'}</div>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">停用后新建交易时不再出现在支付卡片里，历史交易不受影响。</p>
            </div>
            <Switch checked={form.is_active} onClick={() => update({ is_active: !form.is_active })} label="启用此支付方式" />
          </div>

          {error && <div className="sn-form-alert-error">{error}</div>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={guard.handleCloseRequest} className={button.secondary}>
              取消
            </button>
            <button type="submit" disabled={saving} className={button.primary}>
              {saving ? '保存中...' : method ? '保存更改' : '添加'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={guard.showConfirm}
        onClose={guard.cancelConfirm}
        onConfirm={guard.doClose}
        title={UNSAVED_CHANGES_CONFIRM.title}
        message={UNSAVED_CHANGES_CONFIRM.message}
        confirmText={UNSAVED_CHANGES_CONFIRM.confirmText}
        cancelText={UNSAVED_CHANGES_CONFIRM.cancelText}
      />
    </>
  );
}
