// app/settings/page.tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BuildingShop20Filled, BuildingShop20Regular } from '@fluentui/react-icons/headless/svg/building-shop';
import { Cart20Filled, Cart20Regular } from '@fluentui/react-icons/headless/svg/cart';
import { Color20Filled, Color20Regular } from '@fluentui/react-icons/headless/svg/color';
import { DocumentArrowUp20Filled, DocumentArrowUp20Regular } from '@fluentui/react-icons/headless/svg/document-arrow-up';
import { Payment20Filled, Payment20Regular } from '@fluentui/react-icons/headless/svg/payment';
import DualIcon from '@/components/fluent/DualIcon';
import { importOrderFile, OrderImportError, type OrderImportResult } from '@/lib/api/order-import';
import { downloadImportTemplate } from '@/lib/api/order-export';
import MessageBar from '@/components/fluent/MessageBar';
import { loadAmazonPointConfig, DEFAULT_AMAZON_CONFIG, dismissLegacyAmazonCardRate, getLegacyAmazonCardRate, type AmazonPointConfig } from '@/lib/amazon-point-config';
import { getKnownStores, loadKaitorixConfig, saveKaitorixConfig, type KaitorixConfig, type KaitorixStore } from '@/lib/kaitorix-config';
import { getThemePreference, setThemePreference, THEME_PREFERENCE_EVENT, type ThemePreference } from '@/lib/theme-mode';
import { button, card, heading, input, layout } from '@/lib/theme';
import Switch from '@/components/Switch';
import Select from '@/components/Select';
import PaymentMethodsSection from '@/components/settings/PaymentMethodsSection';
import TabList from '@/components/fluent/TabList';
import { SETTINGS_SECTIONS, initSettingsSection, selectSettingsSection, useSettingsSection, type SettingsSectionId } from '@/lib/settings-nav';
import { useSectionDrawer } from '@/lib/section-drawer';
import PageHeader from '@/components/shell/PageHeader';
import { scrollAppToTop } from '@/lib/app-scroll';
import Spinner from '@/components/fluent/Spinner';

const SECTION_ICONS: Record<SettingsSectionId, ReactNode> = {
  appearance: <DualIcon regular={Color20Regular} filled={Color20Filled} />,
  amazon: <DualIcon regular={Cart20Regular} filled={Cart20Filled} />,
  'payment-methods': <DualIcon regular={Payment20Regular} filled={Payment20Filled} />,
  kaitorix: <DualIcon regular={BuildingShop20Regular} filled={BuildingShop20Filled} />,
  'csv-import': <DualIcon regular={DocumentArrowUp20Regular} filled={DocumentArrowUp20Filled} />,
};

const DRAWER_ITEMS = SETTINGS_SECTIONS.map(item => ({ ...item, icon: SECTION_ICONS[item.id] }));

export default function SettingsPage() {
  const section = useSettingsSection();
  useSectionDrawer({ path: '/settings', items: DRAWER_ITEMS, selected: section, onSelect: selectSettingsSection });
  const [config, setConfig] = useState<AmazonPointConfig>(DEFAULT_AMAZON_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [kaitorixConfig, setKaitorixConfig] = useState<KaitorixConfig>({ enabled: false, enabledStores: [] });
  const [knownStores, setKnownStores] = useState<KaitorixStore[]>([]);
  const [kaitorixSaving, setKaitorixSaving] = useState(false);
  const [kaitorixSaveMessage, setKaitorixSaveMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<OrderImportResult | null>(null);
  // 校验或写入失败：整份没有导入，列出全部原因
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 初始为默认值，effect 中读取本机保存的偏好（避免 SSR 水合不一致）
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  // 旧版「信用卡返还」%：已改由支付方式的店铺特殊规则负责，本机设置里还有旧值时提示迁移
  const [legacyCardRate, setLegacyCardRate] = useState<number | null>(null);

  useEffect(() => {
    setConfig(loadAmazonPointConfig());
    setLegacyCardRate(getLegacyAmazonCardRate());
    setKaitorixConfig(loadKaitorixConfig());
    setKnownStores(getKnownStores());
    setThemePreferenceState(getThemePreference());
    // 顶栏快速切换会把偏好改成浅色 / 深色，这里同步显示
    const handlePreferenceChange = () => setThemePreferenceState(getThemePreference());
    window.addEventListener(THEME_PREFERENCE_EVENT, handlePreferenceChange);
    return () => window.removeEventListener(THEME_PREFERENCE_EVENT, handlePreferenceChange);
  }, []);

  // 地址带分区 hash 时按 hash 显示（抽屉的开关由 lib/section-drawer.ts 按入口与宽度决定）
  useEffect(() => {
    initSettingsSection();
  }, []);

  // 切换分区 = Loop 的切页：新分区从顶部开始（首次进入时由外壳决定滚动位置）
  const shownSectionRef = useRef(section);
  useEffect(() => {
    if (shownSectionRef.current === section) return;
    shownSectionRef.current = section;
    scrollAppToTop();
  }, [section]);

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
    setImportErrors([]);
    try {
      setImportResult(await importOrderFile(file));
    } catch (err) {
      setImportErrors(err instanceof OrderImportError ? err.errors : [err instanceof Error ? err.message : String(err)]);
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
    { key: 'd_point_rate', label: 'd 积分', step: '0.1', max: 100, suffix: '%', width: 'w-24' },
    { key: 'd_point_cap', label: 'd 积分上限', step: '1', suffix: '¥', width: 'w-28' },
  ];

  return (
    <div className={layout.page}>
      <PageHeader crumbs={[{ label: '设置' }, { label: SETTINGS_SECTIONS.find(item => item.id === section)?.label ?? '' }]} />
      {/* 一次只显示一个分区：桌面在左侧抽屉切换，手机在顶部横向 Tab 切换 */}
      <div className={"mx-auto max-w-6xl px-4 py-6 " + layout.narrowDesktop}>
        <div className="mb-6 md:mb-0">
          <h1 className={heading.page}>设置</h1>
        </div>

        <div className="mb-4 md:hidden">
          <TabList items={SETTINGS_SECTIONS} selected={section} onSelect={selectSettingsSection} ariaLabel="设置分区" />
        </div>

        <div>
          {section === 'appearance' && (
          <section className={card.primary + ' p-6'}>
            <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
              外观
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">选择「跟随系统」时随系统的深浅色自动切换；顶栏按钮可以临时切换深色 / 浅色。</p>

            <div className="mt-6 text-sm text-[var(--color-text)]">
              深浅色
              <div className="mt-2 max-w-xs">
                <Select
                  value={themePreference}
                  onChange={value => setThemePreference(value as ThemePreference)}
                  options={[
                    { value: 'light', label: '浅色' },
                    { value: 'dark', label: '深色' },
                    { value: 'system', label: '跟随系统' },
                  ]}
                />
              </div>
            </div>
          </section>
          )}

          {section === 'amazon' && (
          <section className={card.primary + ' p-6'}>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
                  Amazon 积分返还自动计算
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">Amazon 采购时自动计算平台积分与 d 积分。卡积分按「支付方式」分区里的返点率与店铺特殊规则计算。</p>
              </div>
              <Switch
                checked={config.auto_calc_enabled}
                onClick={() => updateConfig('auto_calc_enabled', !config.auto_calc_enabled)}
                tone="warning"
                label="新采购时自动计算"
              />
            </div>

            {legacyCardRate !== null && (
              <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-subtle)] p-3 text-sm text-[var(--color-text)]">
                <p>
                  原来这里的「信用卡返还 {legacyCardRate}%」已移除：它不分卡、一律按这个比例算，录入顺序不同结果还会不一样。
                  如果是某张卡在 Amazon 返 {legacyCardRate}%，请在「支付方式」分区里编辑那张卡，添加一条「Amazon → {legacyCardRate}%」的店铺特殊规则。
                </p>
                <button
                  type="button"
                  onClick={() => { dismissLegacyAmazonCardRate(); setLegacyCardRate(null); }}
                  className="mt-2 text-xs font-medium text-[var(--color-warning)] hover:underline"
                >
                  已设置好，不再提示
                </button>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
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
              <button onClick={saveConfig} disabled={saving} className={button.primary + ' max-md:px-6 max-md:py-2'}>
                {saving ? '保存中...' : '保存'}
              </button>
              {saveMessage && <span className="text-sm text-[var(--color-success)]">{saveMessage}</span>}
            </div>
          </section>
          )}

          {section === 'payment-methods' && <PaymentMethodsSection />}

          {section === 'kaitorix' && (
          <section className={card.primary + ' p-6'}>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
                  买取价格检查
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">从 KaitoriX 获取买取价格，在交易列表中显示预期利润。</p>
              </div>
              <Switch
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
                        isChecked ? 'bg-[var(--color-primary-bg)] text-white' : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]'
                      }`}>
                        {isChecked && (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm ${isChecked ? 'font-medium' : 'font-normal'}`}>{store.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button onClick={saveKaitorixSettings} disabled={kaitorixSaving} className={button.primary + ' max-md:px-6 max-md:py-2'}>
                {kaitorixSaving ? '保存中...' : '保存'}
              </button>
              {kaitorixSaveMessage && <span className="text-sm text-[var(--color-success)]">{kaitorixSaveMessage}</span>}
            </div>
          </section>
          )}

          {section === 'csv-import' && (
          <section className={card.primary + ' p-6'}>
            <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
              数据导入
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              与买取X 的「数据导入」同一格式：XLSX = 全部数据（进货・出售・退货・经费），CSV = 进货・出售。买取X 导出的文件可以直接导入。
            </p>

            <div className="mt-6 space-y-4">
              <MessageBar intent="warning">
                只追加：与已有进货的「日期 + 商品名 + 数量 + 单价 + 订单ID（为空时用 JAN）」相同的会跳过；有一条出错整份不导入。
              </MessageBar>

              <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-8 text-center">
                <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleImport} className="hidden" id="order-upload" />
                <label
                  htmlFor="order-upload"
                  className={`${button.primary} inline-flex cursor-pointer items-center max-md:px-6 max-md:py-2 ${importing ? 'pointer-events-none opacity-50' : ''}`}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      导入中...
                    </span>
                  ) : '选择文件（.xlsx / .csv）'}
                </label>
                <div className="mt-3">
                  <button type="button" onClick={() => downloadImportTemplate()} className={button.link}>
                    下载模板（.xlsx）
                  </button>
                </div>
              </div>

              {importResult && (
                <MessageBar intent={importResult.unmatchedAccounts.length > 0 ? 'warning' : 'success'}>
                  <div>
                    导入完成：进货 {importResult.purchases} 笔、出售 {importResult.sales} 条、退货 {importResult.returns} 条、经费 {importResult.expenses} 条
                    {importResult.skipped > 0 && `；已存在跳过 ${importResult.skipped} 笔`}
                  </div>
                  {importResult.unmatchedAccounts.length > 0 && (
                    <div className="mt-1">
                      这些账号在支付方式里找不到，对应进货没有关联支付方式：{importResult.unmatchedAccounts.join('、')}
                    </div>
                  )}
                </MessageBar>
              )}

              {importErrors.length > 0 && (
                <MessageBar intent="error" role="alert">
                  <div className="font-semibold">没有导入任何数据（共 {importErrors.length} 处问题）</div>
                  <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5">
                    {importErrors.map((err, i) => (
                      <li key={i} className="whitespace-pre-wrap">{err}</li>
                    ))}
                  </ul>
                </MessageBar>
              )}
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  );
}
