// app/settings/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { importCSV, type ImportResult } from '@/lib/api/import-csv';
import Link from 'next/link';
import { layout, heading, button, input } from '@/lib/theme';
import { loadAmazonPointConfig, DEFAULT_AMAZON_CONFIG, type AmazonPointConfig } from '@/lib/amazon-point-config';
import { loadKaitorixConfig, saveKaitorixConfig, getKnownStores, type KaitorixConfig, type KaitorixStore } from '@/lib/kaitorix-config';

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

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        <div className={layout.section}>
          <h1 className={heading.h1 + ' mb-2'}>设置</h1>
          <p className="text-gray-600 dark:text-gray-400">积分返还率和数据管理</p>
        </div>

        {/* ナビゲーション */}
        <div className="flex gap-3 mb-8">
          <Link
            href="/settings/payment-methods"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            支付方式 →
          </Link>
        </div>

        {/* Amazon 返ポイント自動計算 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
            Amazon 积分返还自动计算
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Amazon采购时自动计算积分的返还率设置
          </p>

          {/* 自动计算トグル */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                新采购时自动计算
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                当采购平台为Amazon时，自动填入积分
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.auto_calc_enabled}
              onClick={() => updateConfig('auto_calc_enabled', !config.auto_calc_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.auto_calc_enabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.auto_calc_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-4">
            {/* Amazon ポイント */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="w-48 font-medium text-gray-900 dark:text-white text-sm">
                Amazon 积分
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config.amazon_point_rate}
                  onChange={e => updateConfig('amazon_point_rate', parseFloat(e.target.value) || 0)}
                  className={input.base + ' w-20 text-center text-sm'}
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>

            {/* キャンペーン */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="w-48 font-medium text-gray-900 dark:text-white text-sm">
                活动
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config.campaign_rate}
                  onChange={e => updateConfig('campaign_rate', parseFloat(e.target.value) || 0)}
                  className={input.base + ' w-20 text-center text-sm'}
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>

            {/* カード還元 */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="w-48 font-medium text-gray-900 dark:text-white text-sm">
                信用卡返还
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-normal">不含积分使用部分</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config.card_rate}
                  onChange={e => updateConfig('card_rate', parseFloat(e.target.value) || 0)}
                  className={input.base + ' w-20 text-center text-sm'}
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>

            {/* d ポイント */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="w-48 font-medium text-gray-900 dark:text-white text-sm">
                d 积分
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config.d_point_rate}
                  onChange={e => updateConfig('d_point_rate', parseFloat(e.target.value) || 0)}
                  className={input.base + ' w-20 text-center text-sm'}
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>

            {/* d ポイント上限 */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="w-48 font-medium text-gray-900 dark:text-white text-sm">
                d 积分上限
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={config.d_point_cap}
                  onChange={e => updateConfig('d_point_cap', parseFloat(e.target.value) || 0)}
                  className={input.base + ' w-24 text-center text-sm'}
                />
                <span className="text-xs text-gray-500">¥</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={saveConfig}
              disabled={saving}
              className={button.primary + ' px-6 py-2'}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {saveMessage && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">{saveMessage}</span>
            )}
          </div>
        </div>

        {/* 买取价格检查 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-teal-500 to-cyan-500 rounded-full"></div>
            买取价格检查
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            从KaitoriX获取最新买取价格并显示预期利润
          </p>

          {/* 功能开关 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                启用买取价格检查
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                在交易列表中显示买取价格和预期利润
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={kaitorixConfig.enabled}
              onClick={() => setKaitorixConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                kaitorixConfig.enabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  kaitorixConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 店铺选择 */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              选择要检查的店铺
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {knownStores.map(store => {
                const isChecked = kaitorixConfig.enabledStores.includes(store.key);
                return (
                  <button
                    key={store.key}
                    type="button"
                    onClick={() => toggleKaitorixStore(store.key)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      isChecked
                        ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-300'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      isChecked
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`}>
                      {isChecked && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">{store.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={saveKaitorixSettings}
              disabled={kaitorixSaving}
              className={button.primary + ' px-6 py-2'}
            >
              {kaitorixSaving ? '保存中...' : '保存'}
            </button>
            {kaitorixSaveMessage && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">{kaitorixSaveMessage}</span>
            )}
          </div>
        </div>

        {/* CSV导入 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
            CSV导入
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            从purchases.csv格式文件批量导入交易数据
          </p>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className={`${button.primary} px-6 py-2 cursor-pointer inline-block ${importing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    导入中...
                  </span>
                ) : '选择CSV文件'}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                支持格式: 仕入日, 商品名, JAN, 仕入単価, 数量, 仕入先, 注文ID ...
              </p>
            </div>

            {importResult && (
              <div className={`p-4 rounded-xl border ${
                importResult.errors.length > 0
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              }`}>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    成功: {importResult.success}件
                  </span>
                  {importResult.skipped > 0 && (
                    <span className="text-sm text-gray-500">
                      跳过: {importResult.skipped}件
                    </span>
                  )}
                  {importResult.errors.length > 0 && (
                    <span className="text-sm text-red-600 dark:text-red-400">
                      错误: {importResult.errors.length}件
                    </span>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600 dark:text-red-400">{err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
