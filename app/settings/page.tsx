// app/settings/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { importCSV, type ImportResult } from '@/lib/api/import-csv';
import { loadAmazonPointConfig, DEFAULT_AMAZON_CONFIG, type AmazonPointConfig } from '@/lib/amazon-point-config';
import { getKnownStores, loadKaitorixConfig, saveKaitorixConfig, type KaitorixConfig, type KaitorixStore } from '@/lib/kaitorix-config';
import { button, card, heading, input, layout } from '@/lib/theme';

function Toggle({
  checked,
  onClick,
  tone = 'primary',
  label,
}: {
  checked: boolean;
  onClick: () => void;
  tone?: 'primary' | 'warning';
  label: string;
}) {
  const activeClass = tone === 'warning' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-primary)]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? activeClass : 'bg-[var(--color-border)]'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AmazonPointConfig>(DEFAULT_AMAZON_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [kaitorixConfig, setKaitorixConfig] = useState<KaitorixConfig>({ enabled: false, enabledStores: [] });
  const [knownStores, setKnownStores] = useState<KaitorixStore[]>([]);
  const [kaitorixSaving, setKaitorixSaving] = useState(false);
  const [kaitorixSaveMessage, setKaitorixSaveMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(loadAmazonPointConfig());
    setKaitorixConfig(loadKaitorixConfig());
    setKnownStores(getKnownStores());
  }, []);

  const updateConfig = (field: keyof AmazonPointConfig, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const saveConfig = () => {
    setSaving(true);
    localStorage.setItem('amazon_point_config', JSON.stringify(config));
    setSaveMessage('已保存');
    setSaving(false);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  const toggleKaitorixStore = (storeKey: string) => {
    setKaitorixConfig(prev => {
      const isEnabled = prev.enabledStores.includes(storeKey);
      return {
        ...prev,
        enabledStores: isEnabled
          ? prev.enabledStores.filter(k => k !== storeKey)
          : [...prev.enabledStores, storeKey],
      };
    });
  };

  const saveKaitorixSettings = () => {
    setKaitorixSaving(true);
    saveKaitorixConfig(kaitorixConfig);
    setKaitorixSaveMessage('已保存');
    setKaitorixSaving(false);
    setTimeout(() => setKaitorixSaveMessage(''), 2000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const result = await importCSV(file);
      setImportResult(result);
    } catch (err: any) {
      setImportResult({ success: 0, skipped: 0, errors: [err.message] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pointRows: Array<{
    key: keyof AmazonPointConfig;
    label: string;
    hint?: string;
    step: string;
    max?: number;
    suffix: string;
    width: string;
  }> = [
    { key: 'amazon_point_rate', label: 'Amazon 积分', step: '0.1', max: 100, suffix: '%', width: 'w-24' },
    { key: 'campaign_rate', label: '活动', step: '0.1', max: 100, suffix: '%', width: 'w-24' },
    { key: 'card_rate', label: '信用卡返还', hint: '不含积分使用部分', step: '0.1', max: 100, suffix: '%', width: 'w-24' },
    { key: 'd_point_rate', label: 'd 积分', step: '0.1', max: 100, suffix: '%', width: 'w-24' },
    { key: 'd_point_cap', label: 'd 积分上限', step: '1', suffix: '¥', width: 'w-28' },
  ];

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={heading.h1}>设置</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">积分返还率、买取价格与数据导入</p>
          </div>
          <Link href="/settings/payment-methods" className={button.secondary + ' inline-flex items-center gap-2'}>
            支付方式
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
                  <span className="h-6 w-1 rounded-full bg-[var(--color-warning)]" />
                  Amazon 积分返还自动计算
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">Amazon 采购时自动计算积分返还率。</p>
              </div>
              <Toggle
                checked={config.auto_calc_enabled}
                onClick={() => updateConfig('auto_calc_enabled', !config.auto_calc_enabled)}
                tone="warning"
                label="新采购时自动计算"
              />
            </div>

            <div className="space-y-3">
              {pointRows.map(row => (
                <div key={row.key} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">{row.label}</div>
                    {row.hint && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{row.hint}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={row.step}
                      min="0"
                      max={row.max}
                      value={config[row.key] as number}
                      onChange={e => updateConfig(row.key, parseFloat(e.target.value) || 0)}
                      className={input.base + ` ${row.width} text-center text-sm`}
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">{row.suffix}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button onClick={saveConfig} disabled={saving} className={button.primary + ' px-6 py-2'}>
                {saving ? '保存中...' : '保存'}
              </button>
              {saveMessage && <span className="text-sm text-[var(--color-success)]">{saveMessage}</span>}
            </div>
          </section>

          <section className={card.primary + ' p-6'}>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
                  <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
                  买取价格检查
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">从 KaitoriX 获取买取价格，在交易列表中显示预期利润。</p>
              </div>
              <Toggle
                checked={kaitorixConfig.enabled}
                onClick={() => setKaitorixConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                label="启用买取价格检查"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-[var(--color-text)]">选择要检查的店铺</label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {knownStores.map(store => {
                  const isChecked = kaitorixConfig.enabledStores.includes(store.key);
                  return (
                    <button
                      key={store.key}
                      type="button"
                      onClick={() => toggleKaitorixStore(store.key)}
                      className={`flex items-center gap-2 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
                        isChecked
                          ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                          : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-bg-elevated)]'
                      }`}
                    >
                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
                        isChecked ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]'
                      }`}>
                        {isChecked && (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm font-semibold">{store.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button onClick={saveKaitorixSettings} disabled={kaitorixSaving} className={button.primary + ' px-6 py-2'}>
                {kaitorixSaving ? '保存中...' : '保存'}
              </button>
              {kaitorixSaveMessage && <span className="text-sm text-[var(--color-success)]">{kaitorixSaveMessage}</span>}
            </div>
          </section>

          <section className={card.primary + ' p-6'}>
            <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              CSV 导入
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">从 purchases.csv 格式文件批量导入交易数据。</p>

            <div className="mt-6 space-y-4">
              <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-8 text-center">
                <svg className="mx-auto mb-3 h-12 w-12 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" id="csv-upload" />
                <label
                  htmlFor="csv-upload"
                  className={`${button.primary} inline-flex cursor-pointer items-center px-6 py-2 ${importing ? 'pointer-events-none opacity-50' : ''}`}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      导入中...
                    </span>
                  ) : '选择 CSV 文件'}
                </label>
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  支持格式: 采购日、商品名、JAN、采购单价、数量、采购平台、订单 ID ...
                </p>
              </div>

              {importResult && (
                <div className={`rounded-[var(--radius-md)] border p-4 ${
                  importResult.errors.length > 0
                    ? 'bg-[rgba(245,158,11,0.08)] border-[rgba(245,158,11,0.3)]'
                    : 'bg-[var(--color-primary-light)] border-[var(--color-primary)]/30'
                }`}>
                  <div className="mb-2 flex flex-wrap items-center gap-4">
                    <span className="text-sm font-semibold text-[var(--color-success)]">成功: {importResult.success} 件</span>
                    {importResult.skipped > 0 && <span className="text-sm text-[var(--color-text-muted)]">跳过: {importResult.skipped} 件</span>}
                    {importResult.errors.length > 0 && <span className="text-sm text-[var(--color-danger)]">错误: {importResult.errors.length} 件</span>}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="text-xs text-[var(--color-danger)]">{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
