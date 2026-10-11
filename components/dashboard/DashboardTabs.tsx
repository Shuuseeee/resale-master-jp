// components/dashboard/DashboardTabs.tsx — 仪表盘底部标签页（复刻买取X：库存 / 未到货 / 出售记录 / JAN 汇总 / 经费 + まとめ比較）
// 数据来自仪表盘已取的原始数据（lib/dashboard/tabs.ts），跟随页面筛选；每个标签页另有自己的小筛选与 CSV 导出。
// 「まとめ比較」= 勾选的库存 / 未到货商品打开本应用的买取比较（BuybackComparisonModal），价格用仪表盘已取的报价；弹层里的「官方强刷」才消耗官方 API 额度。
'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import TabList from '@/components/fluent/TabList';
import { CHIP_BAR, Chip, ClearChip, FilterSheet, SheetOptionList } from '@/components/mobile-filter';
import Select from '@/components/Select';
import Modal, { ConfirmModal, UNSAVED_CHANGES_CONFIRM } from '@/components/Modal';
import BatchSaleForm from '@/components/BatchSaleForm';
import BuybackComparisonModal from '@/components/BuybackComparisonModal';
import CopyableJan from '@/components/CopyableJan';
import { ProductImage } from '@/components/OptimizedImage';
import Toast from '@/components/Toast';
import { useModalCloseGuard } from '@/hooks/useModalCloseGuard';
import { supabase } from '@/lib/supabase/client';
import { markTransactionArrived } from '@/lib/api/arrivals';
import { downloadCsv } from '@/lib/api/order-export';
import { forceRefreshBuybackPrice } from '@/lib/api/kaitorix';
import { fetchJanThumbnails, type JanThumbnailMap } from '@/lib/api/jan-thumbnails';
import { formatCurrency } from '@/lib/financial/calculator';
import { input } from '@/lib/theme';
import { expenseCategoryLabel } from '@/lib/expenses/categories';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { TransactionForCompare } from '@/hooks/useBuybackComparison';
import type { Transaction } from '@/types/database.types';
import type { DashboardData, DashExpense } from '@/lib/dashboard/data';
import type { DashFilters } from '@/lib/dashboard/summary';
import {
  expenseRows,
  inStockRows,
  janRows,
  pendingRows,
  priceDiffs,
  saleRows,
  toCsv,
  type JanRow,
  type PriceInfo,
  type SaleRow,
  type StockRow,
} from '@/lib/dashboard/tabs';

type TabId = 'stock' | 'pending' | 'sales' | 'jan' | 'expenses';
const TAB_STORAGE = 'dashboardTab';

interface SubFilters {
  jan: string;
  source: string;
  account: string;
  target: string;
  orderId: string;
  category: string;
}
const EMPTY_SUB: SubFilters = { jan: '', source: '', account: '', target: '', orderId: '', category: '' };

const signed = (n: number) => (n > 0 ? 'text-[var(--color-success)]' : n < 0 ? 'text-[var(--color-danger)]' : '');
const fmtDate = (d: string) => d.replace(/-/g, '/');

function Product({ id, name, jan, image }: { id: string | null; name: string; jan: string | null; image?: string }) {
  return (
    <div className="flex min-w-[220px] items-center gap-2">
      {image && <ProductImage src={image} alt={name} size="sm" className="flex-shrink-0" />}
      <div className="min-w-0">
        {id ? (
          <Link href={`/transactions/${id}`} className="line-clamp-2 break-cjk text-sm font-medium leading-snug text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            {name}
          </Link>
        ) : (
          <span className="line-clamp-2 break-cjk text-sm font-medium leading-snug">{name}</span>
        )}
        {jan && <CopyableJan jan={jan} className="mt-0.5 block text-xs text-[var(--color-text-muted)]" />}
      </div>
    </div>
  );
}

function BestPrice({ best, diff }: { best: PriceInfo | null; diff: number | null }) {
  if (!best) return <span className="text-[var(--color-text-muted)]">无报价</span>;
  return (
    <div className="whitespace-nowrap">
      <div className="font-medium">
        {formatCurrency(best.price)}
        {diff != null && diff !== 0 && (
          <span className={`ml-1 text-xs ${signed(diff)}`}>
            {diff > 0 ? '▲' : '▼'}
            {formatCurrency(Math.abs(diff))}
          </span>
        )}
      </div>
      <div className="max-w-[140px] truncate text-xs text-[var(--color-text-muted)]" title={best.stores.join('、')}>
        {best.stores.join('、')}
      </div>
    </div>
  );
}

function Money({ value, color = false }: { value: number | null; color?: boolean }) {
  if (value == null) return <span className="text-[var(--color-text-muted)]">-</span>;
  return <span className={`whitespace-nowrap ${color ? signed(value) : ''}`}>{formatCurrency(value)}</span>;
}

function Options({ label, value, onChange, values, labelOf = v => v }: { label: string; value: string; onChange: (v: string) => void; values: string[]; labelOf?: (v: string) => string }) {
  return (
    <div className="w-40">
      <Select value={value} onChange={onChange} placeholder={label} clearable className={input.base + ' w-full'} options={values.map(v => ({ value: v, label: labelOf(v) }))} />
    </div>
  );
}

const uniq = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))].sort();

interface Props {
  data: DashboardData;
  filters: DashFilters;
  best: Map<string, PriceInfo>;
  enabledStores: ReadonlySet<string> | null;
  today: string;
}

export default function DashboardTabs({ data, filters, best, enabledStores, today }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('stock');
  const [sub, setSub] = useState<Record<TabId, SubFilters>>({ stock: EMPTY_SUB, pending: EMPTY_SUB, sales: EMPTY_SUB, jan: EMPTY_SUB, expenses: EMPTY_SUB });
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [thumbs, setThumbs] = useState<JanThumbnailMap>(new Map());
  const [saleTx, setSaleTx] = useState<Transaction | null>(null);
  const [arriveId, setArriveId] = useState<string | null>(null);
  const [subSheet, setSubSheet] = useState<keyof SubFilters | null>(null);
  const [compareTxs, setCompareTxs] = useState<TransactionForCompare[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE) as TabId | null;
      if (saved && ['stock', 'pending', 'sales', 'jan', 'expenses'].includes(saved)) setTab(saved);
    } catch {}
  }, []);

  // 缩略图按 JAN 全站共享，取不到只是不显示图片
  useEffect(() => {
    const jans = uniq(data.purchases.map(p => p.jan));
    fetchJanThumbnails(jans).then(setThumbs);
  }, [data]);

  const cardNames = useMemo(() => new Map(data.paymentMethods.map(pm => [pm.id, pm.name])), [data.paymentMethods]);
  const account = (cardId: string | null) => (cardId ? cardNames.get(cardId) ?? '' : '');
  const image = (jan: string | null) => (jan ? thumbs.get(jan)?.image_url : undefined);

  const diffs = useMemo(() => priceDiffs(data, best, enabledStores, today), [data, best, enabledStores, today]);
  const stock = useMemo(() => inStockRows(data, filters, best, diffs), [data, filters, best, diffs]);
  const pending = useMemo(() => pendingRows(data, filters, best, diffs), [data, filters, best, diffs]);
  const sales = useMemo(() => saleRows(data, filters), [data, filters]);
  const jans = useMemo(() => janRows(data, filters, best, diffs), [data, filters, best, diffs]);
  const expenses = useMemo(() => expenseRows(data, filters), [data, filters]);

  const f = sub[tab];
  const setF = (patch: Partial<SubFilters>) => setSub(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  const matchStock = (r: StockRow) =>
    (!f.jan || r.p.jan === f.jan) && (!f.source || r.p.source === f.source) && (!f.account || account(r.p.cardId) === f.account);
  const stockShown = stock.filter(matchStock);
  const pendingShown = pending.filter(matchStock);
  const salesShown = sales.filter(
    r =>
      (!f.jan || r.p.jan === f.jan) &&
      (!f.source || r.p.source === f.source) &&
      (!f.target || r.s.target === f.target) &&
      (!f.account || account(r.p.cardId) === f.account) &&
      (!f.orderId || (r.s.orderId ?? '').toLowerCase().includes(f.orderId.toLowerCase())),
  );
  const jansShown = jans.filter(r => !f.jan || r.jan === f.jan);
  const expensesShown = expenses.filter(e => !f.category || e.category === f.category);

  const selectTab = (id: TabId) => {
    setTab(id);
    setSelection({});
    try {
      localStorage.setItem(TAB_STORAGE, id);
    } catch {}
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] });

  const openSale = async (id: string) => {
    const { data: tx, error } = await supabase.from('transactions').select('*').eq('id', id).single();
    if (error || !tx) {
      setToast('读取交易失败，请重试');
      return;
    }
    setSaleTx(tx as Transaction);
  };
  const saleGuard = useModalCloseGuard(() => setSaleTx(null));

  const confirmArrival = async () => {
    if (!arriveId) return;
    const ok = await markTransactionArrived(arriveId);
    setArriveId(null);
    setToast(ok ? '已标记为到货' : '操作失败，请重试');
    if (ok) refresh();
  };

  // 比价弹层里的官方强刷：服务端写入价格缓存后重拉仪表盘数据（报价来自视图 assistant_buyback_prices）
  const forceRefreshJan = useCallback(async (jan: string) => {
    const result = await forceRefreshBuybackPrice(jan);
    if (!result.data) return { ok: false, error: result.error };
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    return { ok: true };
  }, [queryClient]);

  // まとめ比較：勾选的行 → 本应用的买取比较
  const compareRows = (tab === 'stock' ? stockShown : tab === 'pending' ? pendingShown : []).filter(r => selection[r.p.id]);
  const compareMap = useMemo(() => {
    const map = new Map<string, BuybackInfo>();
    for (const t of compareTxs) {
      const prices = (data.prices[t.jan_code!] ?? []).filter(p => !p.stale && (!enabledStores || enabledStores.has(p.store)));
      const top = best.get(t.jan_code!);
      map.set(t.id, {
        maxPrice: top?.price ?? 0,
        maxStore: top?.stores[0] ?? '',
        expectedProfit: 0,
        loading: false,
        allPrices: prices.map(p => ({ store: p.store, price: p.price, url: '' })),
      });
    }
    return map;
  }, [compareTxs, data.prices, enabledStores, best]);

  const startCompare = () => {
    if (!compareRows.length) return setToast('请先勾选要比较的商品');
    const withJan = compareRows.filter(r => r.p.jan);
    if (!withJan.length) return setToast('请勾选带 JAN 的商品');
    setCompareTxs(
      withJan.map(
        r =>
          ({
            id: r.p.id,
            product_name: r.p.productName,
            purchase_price_total: r.p.unitPrice * r.p.quantity + r.p.shippingFee,
            quantity: r.p.quantity,
            quantity_sold: r.p.soldQty,
            quantity_returned: r.p.returnedQty,
            quantity_in_stock: r.qty,
            jan_code: r.p.jan,
            expected_platform_points: r.p.pointsEarned,
            expected_card_points: 0,
            extra_platform_points: 0,
          }) as TransactionForCompare,
      ),
    );
  };

  const exportCsv = () => {
    const name = `dashboard_${tab}_${today.replace(/-/g, '')}.csv`;
    if (tab === 'stock' || tab === 'pending') {
      const rows = tab === 'stock' ? stockShown : pendingShown;
      downloadCsv(
        toCsv(
          ['进货日期', '商品名', 'JAN', '进货单价', '单件成本', tab === 'stock' ? '库存' : '数量', '进货来源', '账号', '最高收购价', '收购店', '预估利润', '备注'],
          rows.map(r => [r.p.date, r.p.productName, r.p.jan, r.p.unitPrice, r.unitCost, r.qty, r.p.source, account(r.p.cardId), r.best?.price ?? null, r.best?.stores.join('、') ?? null, r.estimated, r.p.notes]),
        ),
        name,
      );
    } else if (tab === 'sales') {
      downloadCsv(
        toCsv(
          ['出售日期', '商品名', 'JAN', '出售对象', '单价', '数量', '合计', '扣除', '进货来源', '账号', '利润', '出售订单ID'],
          salesShown.map(r => [r.s.date, r.p.productName, r.p.jan, r.s.target, r.s.price, r.s.qty, r.total, r.s.deduction, r.p.source, account(r.p.cardId), Math.round(r.profit), r.s.orderId]),
        ),
        name,
      );
    } else if (tab === 'jan') {
      downloadCsv(
        toCsv(
          ['JAN', '商品名', '总数量', '已售', '库存', '未到货', '总投资', '回收额', '利润', '利润率', '平均收购价', '最高收购价', '预估利润'],
          jansShown.map(r => [r.jan, r.productName, r.totalQty, r.soldQty, r.stockQty, r.pendingQty, r.investment, r.revenue, Math.round(r.profit), r.profitRate, r.avgSalePrice, r.best?.price ?? null, r.estimated]),
        ),
        name,
      );
    } else {
      downloadCsv(toCsv(['经费日期', '分类', '金额', '说明'], expensesShown.map(e => [e.date, expenseCategoryLabel(e.category), e.amount, e.description])), name);
    }
  };

  const stockColumns = useMemo((): ColumnDef<StockRow>[] => {
    const isStock = tab === 'stock';
    return [
      {
        id: 'product',
        header: '商品名',
        accessorFn: r => r.p.productName,
        cell: ({ row: { original: r } }) => <Product id={r.p.id} name={r.p.productName} jan={r.p.jan} image={image(r.p.jan)} />,
        meta: { card: { slot: 'title' } },
      },
      { id: 'date', header: '进货日期', accessorFn: r => r.p.date, cell: ({ getValue }) => <span className="whitespace-nowrap">{fmtDate(getValue() as string)}</span>, meta: { card: { slot: 'subtitle' } } },
      {
        id: 'unit',
        header: '进货单价',
        accessorFn: r => r.unitCost,
        cell: ({ row: { original: r } }) => (
          <div className="whitespace-nowrap">
            <div>{formatCurrency(r.p.unitPrice + r.p.shippingFee / r.p.quantity)}</div>
            {r.p.pointsEarned > 0 && <div className="text-xs text-[var(--color-text-muted)]">返{formatCurrency(Math.floor(r.p.pointsEarned / r.p.quantity))}</div>}
          </div>
        ),
        meta: { align: 'right' },
      },
      { id: 'qty', header: isStock ? '库存' : '数量', accessorFn: r => r.qty, meta: { align: 'right' } },
      ...(isStock
        ? [
            {
              id: 'total',
              header: '进货总价',
              accessorFn: (r: StockRow) => r.p.unitPrice * r.qty,
              cell: ({ getValue }: { getValue: () => unknown }) => <Money value={getValue() as number} />,
              meta: { align: 'right' as const, minBreakpoint: 'lg' as const },
            },
          ]
        : []),
      { id: 'source', header: '进货来源', accessorFn: r => r.p.source ?? '', meta: { minBreakpoint: 'lg' } },
      { id: 'account', header: '账号', accessorFn: r => account(r.p.cardId), meta: { minBreakpoint: 'xl' } },
      { id: 'best', header: '收购价', accessorFn: r => r.best?.price ?? -1, cell: ({ row: { original: r } }) => <BestPrice best={r.best} diff={r.diff} />, meta: { align: 'right' } },
      { id: 'estimated', header: '预估利润', accessorFn: r => r.estimated ?? -Infinity, cell: ({ row: { original: r } }) => <Money value={r.estimated} color />, meta: { align: 'right' } },
      ...(!isStock
        ? [{ id: 'memo', header: '备注', accessorFn: (r: StockRow) => r.p.notes ?? '', meta: { minBreakpoint: 'xl' as const, tdClassName: 'max-w-[160px] truncate' } }]
        : []),
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <div className="flex justify-end gap-3 whitespace-nowrap text-sm">
            {isStock ? (
              <button type="button" className="fluent-link" onClick={() => openSale(r.p.id)}>
                出售
              </button>
            ) : (
              <button type="button" className="fluent-link" onClick={() => setArriveId(r.p.id)}>
                确认到货
              </button>
            )}
            <Link href={`/transactions/${r.p.id}`} className="fluent-link">
              详情
            </Link>
          </div>
        ),
        meta: { align: 'right', card: { slot: 'actions' } },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, thumbs, cardNames]);

  const saleColumns = useMemo(
    (): ColumnDef<SaleRow>[] => [
      { id: 'date', header: '出售日期', accessorFn: r => r.s.date, cell: ({ getValue }) => <span className="whitespace-nowrap">{fmtDate(getValue() as string)}</span>, meta: { card: { slot: 'subtitle' } } },
      { id: 'product', header: '商品名', accessorFn: r => r.p.productName, cell: ({ row: { original: r } }) => <Product id={r.p.id} name={r.p.productName} jan={r.p.jan} image={image(r.p.jan)} />, meta: { card: { slot: 'title' } } },
      { id: 'target', header: '出售对象', accessorFn: r => r.s.target ?? '' },
      { id: 'price', header: '单价', accessorFn: r => r.s.price, cell: ({ getValue }) => <Money value={getValue() as number} />, meta: { align: 'right' } },
      { id: 'qty', header: '数量', accessorFn: r => r.s.qty, meta: { align: 'right' } },
      { id: 'total', header: '合计', accessorFn: r => r.total, cell: ({ getValue }) => <Money value={getValue() as number} />, meta: { align: 'right' } },
      { id: 'deduction', header: '扣除', accessorFn: r => r.s.deduction, cell: ({ getValue }) => <Money value={getValue() as number} />, meta: { align: 'right', minBreakpoint: 'lg' } },
      { id: 'source', header: '进货来源', accessorFn: r => r.p.source ?? '', meta: { minBreakpoint: 'xl' } },
      { id: 'account', header: '账号', accessorFn: r => account(r.p.cardId), meta: { minBreakpoint: 'xl' } },
      { id: 'profit', header: '利润', accessorFn: r => r.profit, cell: ({ getValue }) => <Money value={Math.round(getValue() as number)} color />, meta: { align: 'right' } },
      { id: 'order', header: '出售订单ID', accessorFn: r => r.s.orderId ?? '', meta: { minBreakpoint: 'xl' } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbs, cardNames],
  );

  const janColumns = useMemo(
    (): ColumnDef<JanRow>[] => [
      { id: 'product', header: '商品名', accessorFn: r => r.productName, cell: ({ row: { original: r } }) => <Product id={null} name={r.productName} jan={r.jan} image={image(r.jan)} />, meta: { card: { slot: 'title' } } },
      { id: 'sold', header: '已售 / 总数', accessorFn: r => r.soldQty, cell: ({ row: { original: r } }) => <span className="whitespace-nowrap">{r.soldQty} / {r.totalQty}</span>, meta: { align: 'right' } },
      {
        id: 'stock',
        header: '库存',
        accessorFn: r => r.stockQty + r.pendingQty,
        cell: ({ row: { original: r } }) => (
          <span className="whitespace-nowrap">
            {r.stockQty}
            {r.pendingQty > 0 && <span className="text-xs text-[var(--color-text-muted)]">（未到 {r.pendingQty}）</span>}
          </span>
        ),
        meta: { align: 'right' },
      },
      { id: 'investment', header: '总投资', accessorFn: r => r.investment, cell: ({ getValue }) => <Money value={getValue() as number} />, meta: { align: 'right' } },
      { id: 'revenue', header: '回收额', accessorFn: r => r.revenue, cell: ({ getValue }) => <Money value={getValue() as number} />, meta: { align: 'right', minBreakpoint: 'lg' } },
      {
        id: 'profit',
        header: '利润',
        accessorFn: r => r.profit,
        cell: ({ row: { original: r } }) => (
          <div className="whitespace-nowrap">
            <Money value={Math.round(r.profit)} color />
            {r.soldQty > 0 && <div className="text-xs text-[var(--color-text-muted)]">{r.profitRate.toFixed(1)}%</div>}
          </div>
        ),
        meta: { align: 'right' },
      },
      { id: 'avg', header: '平均收购价', accessorFn: r => r.avgSalePrice ?? -1, cell: ({ row: { original: r } }) => <Money value={r.avgSalePrice} />, meta: { align: 'right', minBreakpoint: 'xl' } },
      { id: 'best', header: '收购价', accessorFn: r => r.best?.price ?? -1, cell: ({ row: { original: r } }) => <BestPrice best={r.best} diff={r.diff} />, meta: { align: 'right' } },
      { id: 'estimated', header: '预估利润', accessorFn: r => r.estimated ?? -Infinity, cell: ({ row: { original: r } }) => <Money value={r.estimated} color />, meta: { align: 'right' } },
      {
        id: 'repurchase',
        header: '',
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <Link href={`/transactions/add?copy=${r.latestId}`} className="fluent-link whitespace-nowrap text-sm">
            再次购买
          </Link>
        ),
        meta: { align: 'right', card: { slot: 'actions' } },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbs],
  );

  const expenseColumns = useMemo(
    (): ColumnDef<DashExpense>[] => [
      { id: 'date', header: '经费日期', accessorFn: e => e.date, cell: ({ getValue }) => <span className="whitespace-nowrap">{fmtDate(getValue() as string)}</span>, meta: { card: { slot: 'subtitle' } } },
      { id: 'category', header: '分类', accessorFn: e => expenseCategoryLabel(e.category), meta: { card: { slot: 'title' } } },
      { id: 'amount', header: '金额', accessorFn: e => e.amount, cell: ({ getValue }) => <Money value={getValue() as number} />, meta: { align: 'right' } },
      { id: 'description', header: '说明', accessorFn: e => e.description ?? '' },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row: { original: e } }) => (
          <Link href={`/supplies/${e.id}/edit`} className="fluent-link whitespace-nowrap text-sm">
            编辑
          </Link>
        ),
        meta: { align: 'right', card: { slot: 'actions' } },
      },
    ],
    [],
  );

  const empty = (text: string) => <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{text}</div>;

  const tabs: { id: TabId; label: string }[] = [
    ...(filters.completedOnly
      ? []
      : [
          { id: 'stock' as const, label: `库存（${stock.length}）` },
          { id: 'pending' as const, label: `未到货（${pending.length}）` },
        ]),
    { id: 'sales', label: `出售记录（${sales.length}）` },
    { id: 'jan', label: 'JAN汇总' },
    { id: 'expenses', label: `经费（${expenses.length}）` },
  ];
  const current: TabId = tabs.some(t => t.id === tab) ? tab : 'sales';

  // 每个标签页的小筛选：桌面是一排下拉，手机与交易页一致是 chip 栏 + 底部弹层（同一份定义）
  type SubKey = Exclude<keyof SubFilters, 'orderId'>;
  type OptDef = { key: SubKey; label: string; values: string[]; labelOf?: (v: string) => string };
  let opts: OptDef[] = [];
  let actions: ReactNode = null;
  let showOrderId = false;
  let table: ReactNode = null;
  if (current === 'stock' || current === 'pending') {
    const rows = current === 'stock' ? stock : pending;
    opts = [
      { key: 'jan', label: 'JAN', values: uniq(rows.map(r => r.p.jan)) },
      { key: 'source', label: '进货来源', values: uniq(rows.map(r => r.p.source)) },
      { key: 'account', label: '账号', values: uniq(rows.map(r => account(r.p.cardId))) },
    ];
    actions = (
      <button type="button" className="fluent-btn fluent-btn--default" onClick={startCompare}>
        まとめ比較{Object.keys(selection).length > 0 && `（${Object.keys(selection).length}）`}
      </button>
    );
    table = (
      <DataTable
        data={current === 'stock' ? stockShown : pendingShown}
        columns={stockColumns}
        getRowId={r => r.p.id}
        enableRowSelection
        rowSelection={selection}
        onRowSelectionChange={setSelection}
        mobile="cards"
        bare
        emptyState={empty(current === 'stock' ? '没有库存' : '没有未到货的商品')}
      />
    );
  } else if (current === 'sales') {
    opts = [
      { key: 'jan', label: 'JAN', values: uniq(sales.map(r => r.p.jan)) },
      { key: 'source', label: '进货来源', values: uniq(sales.map(r => r.p.source)) },
      { key: 'target', label: '出售对象', values: uniq(sales.map(r => r.s.target)) },
      { key: 'account', label: '账号', values: uniq(sales.map(r => account(r.p.cardId))) },
    ];
    showOrderId = true;
    table = <DataTable data={salesShown} columns={saleColumns} getRowId={r => `${r.p.id}-${r.s.date}-${r.s.qty}-${r.s.price}-${r.s.orderId ?? ''}`} mobile="cards" bare emptyState={empty('没有出售记录')} />;
  } else if (current === 'jan') {
    opts = [{ key: 'jan', label: 'JAN', values: uniq(jans.map(r => r.jan)) }];
    table = <DataTable data={jansShown} columns={janColumns} getRowId={r => r.jan} mobile="cards" bare emptyState={empty('没有数据')} />;
  } else {
    opts = [{ key: 'category', label: '分类', values: uniq(expenses.map(e => e.category)), labelOf: expenseCategoryLabel }];
    actions = (
      <Link href="/supplies/add" className="fluent-btn fluent-btn--default">
        添加经费
      </Link>
    );
    table = <DataTable data={expensesShown} columns={expenseColumns} getRowId={e => e.id} mobile="cards" bare emptyState={empty('没有经费')} />;
  }
  const subActive = opts.some(o => f[o.key]) || (showOrderId && !!f.orderId);
  const sheetDef = opts.find(o => o.key === subSheet);
  const orderIdInput = (cls: string) => (
    <input value={f.orderId} onChange={e => setF({ orderId: e.target.value })} placeholder="出售订单ID" className={input.base + ' ' + cls} />
  );
  const exportButton = (
    <button type="button" className="fluent-btn fluent-btn--subtle" onClick={exportCsv}>
      导出 CSV
    </button>
  );

  return (
    <section>
      <div className="overflow-x-auto">
        <TabList items={tabs} selected={current} onSelect={selectTab} ariaLabel="明细" />
      </div>
      {/* 手机：chip 栏 + 底部弹层，操作按钮另起一行 */}
      <div className="mt-3 space-y-2 lg:hidden">
        <div className={CHIP_BAR}>
          {subActive && <ClearChip onClick={() => setF({ ...EMPTY_SUB })} />}
          {opts.map(o => (
            <Chip key={o.key} label={f[o.key] ? (o.labelOf ?? (v => v))(f[o.key]) : o.label} active={!!f[o.key]} onClick={() => setSubSheet(o.key)} />
          ))}
        </div>
        {showOrderId && orderIdInput('w-full')}
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {exportButton}
        </div>
      </div>
      {sheetDef && (
        <FilterSheet title={sheetDef.label} onClose={() => setSubSheet(null)} showReset={!!f[sheetDef.key]} onReset={() => setF({ [sheetDef.key]: '' })}>
          <SheetOptionList
            mono={sheetDef.key === 'jan'}
            options={sheetDef.values.map(v => ({ value: v, label: (sheetDef.labelOf ?? (x => x))(v) }))}
            value={f[sheetDef.key]}
            onSelect={v => { setF({ [sheetDef.key]: v }); setSubSheet(null); }}
          />
        </FilterSheet>
      )}

      {/* 桌面：一排下拉 */}
      <div className="mt-3 hidden flex-wrap items-center gap-2 lg:flex">
        {opts.map(o => (
          <Options key={o.key} label={o.label} value={f[o.key]} onChange={v => setF({ [o.key]: v })} values={o.values} labelOf={o.labelOf} />
        ))}
        {showOrderId && orderIdInput('w-40')}
        {actions}
        <div className="ml-auto">{exportButton}</div>
      </div>
      <div className="mt-3">{table}</div>

      {saleTx && (
        <Modal
          isOpen
          onClose={saleGuard.doClose}
          beforeClose={saleGuard.handleCloseRequest}
          closeOnEsc={!saleGuard.showConfirm}
          closeOnOverlayClick={!saleGuard.showConfirm}
          title="记录销售"
          size="lg"
        >
          <BatchSaleForm
            transaction={saleTx}
            onSuccess={() => {
              setSaleTx(null);
              setToast('销售已记录');
              refresh();
            }}
            closeOnSuccess
            onCancel={saleGuard.doClose}
            onDirtyChange={saleGuard.setIsDirty}
          />
        </Modal>
      )}
      <ConfirmModal
        isOpen={saleGuard.showConfirm}
        onClose={saleGuard.cancelConfirm}
        onConfirm={saleGuard.doClose}
        title={UNSAVED_CHANGES_CONFIRM.title}
        message={UNSAVED_CHANGES_CONFIRM.message}
        confirmText={UNSAVED_CHANGES_CONFIRM.confirmText}
        cancelText={UNSAVED_CHANGES_CONFIRM.cancelText}
      />
      <ConfirmModal
        isOpen={!!arriveId}
        onClose={() => setArriveId(null)}
        onConfirm={confirmArrival}
        title="确认到货"
        message="确认将此商品标记为已到货？"
        confirmText="确认到货"
        cancelText="取消"
      />
      <BuybackComparisonModal
        isOpen={compareTxs.length > 0}
        onClose={() => setCompareTxs([])}
        selectedTransactions={compareTxs}
        buybackMap={compareMap}
        onForceRefresh={forceRefreshJan}
      />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
  );
}
