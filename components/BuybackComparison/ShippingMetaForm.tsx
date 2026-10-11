// components/BuybackComparison/ShippingMetaForm.tsx — 补 / 改一个 JAN 的出货尺寸（比价弹层、设置「商品尺寸」共用）
'use client';

import { useState } from 'react';
import Select from '@/components/Select';
import { button, input } from '@/lib/theme';
import { BOX_SIZES, SHIPPING_CATEGORIES, saveShippingMeta, type ShippingMeta } from '@/lib/api/shipping-meta';

interface Props {
  jan: string;
  initial?: ShippingMeta | null;
  /** 新建时默认写进备注（商品名，方便以后辨认） */
  defaultNote?: string;
  onSaved: (meta: ShippingMeta) => void;
  onCancel?: () => void;
}

export default function ShippingMetaForm({ jan, initial, defaultNote, onSaved, onCancel }: Props) {
  const [vol, setVol] = useState(initial ? String(initial.vol) : '');
  const [size, setSize] = useState(String(initial?.min_size ?? 60));
  const [category, setCategory] = useState(initial?.category ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const v = parseFloat(vol);
    if (!(v > 0)) return setError('体积要大于 0');
    const meta: ShippingMeta = { jan, vol: Math.round(v * 100) / 100, min_size: Number(size), category: category || null, note: initial?.note ?? defaultNote ?? null };
    setSaving(true);
    setError('');
    try {
      await saveShippingMeta(meta);
      onSaved(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="sn-form-label">体积（L/件，含缓冲）</span>
          <input type="number" min="0" step="0.1" inputMode="decimal" value={vol} onChange={e => setVol(e.target.value)} placeholder="例如 0.3" className={input.base + ' w-full'} />
        </label>
        <label className="block">
          <span className="sn-form-label">最小箱型</span>
          <Select value={size} onChange={setSize} options={BOX_SIZES.map(s => ({ value: String(s), label: `${s} 尺寸` }))} className={input.base + ' w-full'} />
        </label>
        <label className="block">
          <span className="sn-form-label">分类</span>
          <Select value={category || 'none'} onChange={v => setCategory(v === 'none' ? '' : v)} options={SHIPPING_CATEGORIES.map(c => ({ value: c.value || 'none', label: c.label }))} className={input.base + ' w-full'} />
        </label>
      </div>
      {error && <p className="sn-form-error">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className={button.primary}>{saving ? '保存中…' : '保存尺寸'}</button>
        {onCancel && <button type="button" onClick={onCancel} className={button.secondary}>取消</button>}
      </div>
    </div>
  );
}
