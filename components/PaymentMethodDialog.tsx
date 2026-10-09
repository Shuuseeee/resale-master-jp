'use client';

// 支付方式的新增 / 编辑弹窗（设置页「支付方式」区块内使用）。
// 字段：类型、名称、卡号后 4 位（仅信用卡）、返点率、店铺特殊规则、返点积分平台、启用状态（开关）。
// 有未保存修改时关闭会二次确认。

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, PaymentMethodStoreRate, PaymentMethodType, PointsPlatform } from '@/types/database.types';
import Modal, { ConfirmModal, UNSAVED_CHANGES_CONFIRM } from '@/components/Modal';
import Select from '@/components/Select';
import Switch from '@/components/Switch';
import { button, input } from '@/lib/theme';
import { useModalCloseGuard } from '@/hooks/useModalCloseGuard';
import { usePlatforms } from '@/contexts/PlatformsContext';
import { fetchStoreRates, syncStoreRates } from '@/lib/api/payment-method-rules';
import { PAYMENT_METHOD_TYPE_LABELS, percentToPointRate, pointRateToPercent } from '@/lib/utils/paymentMethods';

interface FormState {
  type: PaymentMethodType;
  name: string;
  point_rate: string; // 百分数，如 "1.5"
  card_last4: string;
  card_points_platform_id: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = { type: 'card', name: '', point_rate: '1', card_last4: '', card_points_platform_id: '', is_active: true };

/** 新增时的预填（如从「常用支付方式」一键添加） */
export interface PaymentMethodPreset {
  name: string;
  type: PaymentMethodType;
  percent: number;
}

function formFromMethod(method: PaymentMethod | null, preset: PaymentMethodPreset | null): FormState {
  if (!method) {
    return preset
      ? { ...EMPTY_FORM, type: preset.type, name: preset.name, point_rate: preset.percent.toString() }
      : EMPTY_FORM;
  }
  return {
    type: method.type,
    name: method.name,
    point_rate: pointRateToPercent(method.point_rate).toString(),
    card_last4: method.card_last4 || '',
    card_points_platform_id: method.card_points_platform_id || '',
    is_active: method.is_active,
  };
}

interface PaymentMethodDialogProps {
  isOpen: boolean;
  /** null = 新增 */
  method: PaymentMethod | null;
  /** 新增时的预填 */
  preset?: PaymentMethodPreset | null;
  pointsPlatforms: PointsPlatform[];
  onClose: () => void;
  onSaved: (method: PaymentMethod) => void;
  onDeleted: (id: string) => void;
}

/** 编辑中的一条店铺规则（percent 为百分数字符串） */
interface RuleRow {
  key: string;
  purchase_platform_id: string;
  percent: string;
}

function rulesToRows(rules: PaymentMethodStoreRate[]): RuleRow[] {
  return rules.map(r => ({ key: r.id, purchase_platform_id: r.purchase_platform_id, percent: pointRateToPercent(r.point_rate).toString() }));
}

export default function PaymentMethodDialog({ isOpen, method, preset = null, pointsPlatforms, onClose, onSaved, onDeleted }: PaymentMethodDialogProps) {
  const initial = useMemo(() => formFromMethod(method, preset), [method, preset]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const guard = useModalCloseGuard(onClose);
  const { setIsDirty } = guard;
  const { purchasePlatforms } = usePlatforms();
  // 店铺特殊规则：打开时从库里读出（新增时为空）；existingRules 用于保存时对比增删
  const [existingRules, setExistingRules] = useState<PaymentMethodStoreRate[]>([]);
  const [initialRuleRows, setInitialRuleRows] = useState<RuleRow[]>([]);
  const [ruleRows, setRuleRows] = useState<RuleRow[]>([]);
  const [rulesUnavailable, setRulesUnavailable] = useState(false);

  // 每次打开时用当前卡（或空表单）重置
  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setError(null);
      setConfirmDelete(false);
    }
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return;
    setExistingRules([]); setInitialRuleRows([]); setRuleRows([]); setRulesUnavailable(false);
    if (!method) return;
    let cancelled = false;
    fetchStoreRates(method.id).then(({ data, error: rulesError }) => {
      if (cancelled) return;
      // 线上库还没建规则表时读取会失败：不显示规则编辑，其它字段照常可用
      if (rulesError) { setRulesUnavailable(true); return; }
      setExistingRules(data);
      setInitialRuleRows(rulesToRows(data));
      setRuleRows(rulesToRows(data));
    });
    return () => { cancelled = true; };
  }, [isOpen, method]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initial) || JSON.stringify(ruleRows) !== JSON.stringify(initialRuleRows));
  }, [form, initial, ruleRows, initialRuleRows, setIsDirty]);

  const updateRule = (key: string, patch: Partial<RuleRow>) =>
    setRuleRows(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const addRule = () => setRuleRows(rows => [...rows, { key: `new-${Date.now()}-${rows.length}`, purchase_platform_id: '', percent: form.point_rate || '0' }]);
  const removeRule = (key: string) => setRuleRows(rows => rows.filter(r => r.key !== key));

  const update = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const percent = parseFloat(form.point_rate);
    if (!name) { setError('请填写名称'); return; }
    if (!Number.isFinite(percent) || percent < 0) { setError('返点率请填写 0 或以上的数字'); return; }
    const last4 = form.type === 'card' ? form.card_last4.trim() : '';
    if (last4 && !/^\d{4}$/.test(last4)) { setError('卡号后 4 位请填写 4 位数字，或留空'); return; }
    const desiredRules: Array<{ purchase_platform_id: string; point_rate: number }> = [];
    for (const row of ruleRows) {
      const rulePercent = parseFloat(row.percent);
      if (!row.purchase_platform_id) { setError('店铺特殊规则：请选择采购平台，或删除这一行'); return; }
      if (!Number.isFinite(rulePercent) || rulePercent < 0) { setError('店铺特殊规则：返点率请填写 0 或以上的数字'); return; }
      desiredRules.push({ purchase_platform_id: row.purchase_platform_id, point_rate: percentToPointRate(rulePercent) });
    }

    setSaving(true);
    setError(null);
    const payload = {
      type: form.type,
      name,
      point_rate: percentToPointRate(percent),
      card_points_platform_id: form.card_points_platform_id || null,
      is_active: form.is_active,
      // 只在填了 / 改了后 4 位时才提交这一列：线上库还没加这一列时，不碰它的保存照常成功
      ...(last4 !== initial.card_last4 ? { card_last4: last4 || null } : {}),
    };
    // 还款周期三列（closing_day / payment_day / payment_same_month）不提交：web 不再管理，原生仍在用，不能覆盖
    const { data, error: saveError } = method
      ? await supabase.from('payment_methods').update(payload).eq('id', method.id).select('*').single()
      : await supabase.from('payment_methods').insert([payload]).select('*').single();

    if (saveError || !data) {
      setSaving(false);
      setError(saveError?.message || '保存失败，请重试');
      return;
    }

    // 支付方式本身已保存，再同步店铺规则（规则表不可用时跳过）
    let rulesFailed = false;
    if (!rulesUnavailable && JSON.stringify(ruleRows) !== JSON.stringify(initialRuleRows)) {
      const { error: rulesError } = await syncStoreRates((data as PaymentMethod).id, existingRules, desiredRules);
      if (rulesError) {
        console.error('保存店铺规则失败:', rulesError);
        rulesFailed = true;
      }
    }
    setSaving(false);
    setIsDirty(false);
    onSaved(data as PaymentMethod);
    if (rulesFailed) alert('支付方式已保存，但店铺特殊规则保存失败，请稍后在「编辑」里重试。');
  };

  // 删除：transactions.card_id 外键指向这张卡（无级联），用过的卡数据库会拒绝删除；
  // 先查使用笔数，用过的直接提示改为停用（历史交易的支付卡片不能被抹掉），没用过的再二次确认删除
  const requestDelete = async () => {
    if (!method) return;
    setError(null);
    setDeleting(true);
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('card_id', method.id);
    setDeleting(false);
    if (countError) { setError('无法确认使用情况，请稍后重试'); return; }
    if ((count ?? 0) > 0) {
      setError(`已有 ${count} 笔交易使用此支付方式，无法删除。不再使用的话可以改为停用。`);
      return;
    }
    setConfirmDelete(true);
  };

  const doDelete = async () => {
    if (!method) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('payment_methods').delete().eq('id', method.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (deleteError) {
      // 23503 = 外键约束：确认之后、删除之前恰好有交易用上了这张卡
      setError(deleteError.code === '23503'
        ? '此支付方式已被交易使用，无法删除。不再使用的话可以改为停用。'
        : deleteError.message || '删除失败，请重试');
      return;
    }
    setIsDirty(false);
    onDeleted(method.id);
  };

  const field = input.base + ' w-full';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={guard.doClose}
        beforeClose={guard.handleCloseRequest}
        closeOnEsc={!guard.showConfirm && !confirmDelete}
        closeOnOverlayClick={!guard.showConfirm && !confirmDelete}
        title={method ? '编辑支付方式' : '添加支付方式'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="sn-form-label">类型</label>
            <Select
              value={form.type}
              onChange={v => update({ type: v as PaymentMethodType })}
              options={(Object.keys(PAYMENT_METHOD_TYPE_LABELS) as PaymentMethodType[]).map(t => ({ value: t, label: PAYMENT_METHOD_TYPE_LABELS[t] }))}
              className={field}
            />
          </div>

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

          {form.type === 'card' && <div>
            <label className="sn-form-label">卡号后 4 位（可选）</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={form.card_last4}
              onChange={e => update({ card_last4: e.target.value.replace(/\D/g, '') })}
              className={field}
              placeholder="例如：4821"
            />
            <p className="sn-form-muted">只用来区分名字相近的卡，只保存这 4 位。</p>
          </div>}

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
            <p className="sn-form-muted">新建交易时按「支付金额 × 返点率」自动计算返点积分；1% 填 1。</p>
          </div>

          {!rulesUnavailable && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
              <div className="text-sm font-medium text-[var(--color-text)]">店铺特殊规则</div>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                在某个采购平台用不同的返点率（例如 Amazon 卡在 Amazon 返 3%）。录入交易时按「采购平台」自动套用，优先于上面的返点率。
              </p>
              <div className="mt-3 space-y-2">
                {ruleRows.map(row => {
                  const usedElsewhere = new Set(ruleRows.filter(r => r.key !== row.key).map(r => r.purchase_platform_id));
                  return (
                    <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2">
                      <Select
                        value={row.purchase_platform_id}
                        onChange={v => updateRule(row.key, { purchase_platform_id: v })}
                        options={purchasePlatforms
                          .filter(p => !usedElsewhere.has(p.id))
                          .map(p => ({ value: p.id, label: p.name }))}
                        placeholder="选择采购平台"
                        className={field}
                      />
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={row.percent}
                          onChange={e => updateRule(row.key, { percent: e.target.value })}
                          step="0.01"
                          min="0"
                          className={field + ' pr-7'}
                          aria-label="规则返点率 (%)"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">%</span>
                      </div>
                      <button type="button" onClick={() => removeRule(row.key)} className="px-2 text-xs text-[var(--color-danger)] hover:underline">
                        删除
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={addRule} className="mt-2 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                + 添加规则
              </button>
            </div>
          )}

          <div>
            <label className="sn-form-label">返点积分平台</label>
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
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">停用后新建交易时不再出现在支付方式里，历史交易不受影响。</p>
            </div>
            <Switch checked={form.is_active} onClick={() => update({ is_active: !form.is_active })} label="启用此支付方式" />
          </div>

          {error && <div className="sn-form-alert-error">{error}</div>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {method ? (
              <button
                type="button"
                onClick={requestDelete}
                disabled={deleting || saving}
                className={button.ghost + ' text-[var(--color-danger)] hover:text-[var(--color-danger)]'}
              >
                {deleting ? '处理中...' : '删除'}
              </button>
            ) : <span />}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={guard.handleCloseRequest} className={button.secondary}>
                取消
              </button>
              <button type="submit" disabled={saving || deleting} className={button.primary}>
                {saving ? '保存中...' : method ? '保存更改' : '添加'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="删除支付方式？"
        message={`删除「${method?.name ?? ''}」后无法恢复。它没有被任何交易使用。`}
        confirmText="删除"
        cancelText="取消"
        confirmVariant="danger"
      />

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
