// components/transactions/StatusBadge.tsx — 交易状态徽章（列表表格、手机卡片、详情页共用）
// 颜色用 Loop 表格内标签（lib/theme.ts badge.*）；文字与分区抽屉的状态名一致。
// 部分到货（分批到货只到了一部分）与买取X 一样显示「到货 已到/总数」。
import { badge } from '@/lib/theme';
import { arrivedQty, isPartiallyArrived } from '@/lib/utils/arrivals';

interface StatusFields {
  status: string;
  quantity: number;
  quantity_arrived?: number | null;
  quantity_sold?: number | null;
  quantity_returned?: number | null;
}

/** showStock：库存中时显示剩余件数（「库存 3」，列表用）；详情页不显示（下方有库存信息） */
export function TransactionStatusBadge({ tx, showStock = false }: { tx: StatusFields; showStock?: boolean }) {
  const cls = (tone: string) => `${tone} whitespace-nowrap`;
  switch (tx.status) {
    case 'pending':
      return <span className={cls(badge.pending)}>未到货</span>;
    case 'in_stock': {
      if (isPartiallyArrived(tx)) return <span className={cls(badge.pending)}>到货 {arrivedQty(tx)}/{tx.quantity}</span>;
      const remaining = tx.quantity - (tx.quantity_sold ?? 0) - (tx.quantity_returned ?? 0);
      return <span className={cls(badge.info)}>{showStock ? `库存 ${remaining}` : '库存中'}</span>;
    }
    case 'awaiting_payment':
      return <span className={cls(badge.pending)}>待入账</span>;
    case 'sold':
      return <span className={cls(badge.success)}>已售出</span>;
    case 'returned':
      return <span className={cls(badge.error)}>已退货</span>;
    default:
      return <span className={cls(badge.neutral)}>-</span>;
  }
}
