import { layout } from '@/lib/theme';

// 离线且本机没有可用缓存（从未联网加载过、已登出清理过或缓存已过期）时的整页空态。
// 判断条件：useQuery 的 isPending && fetchStatus === 'paused'。
export default function OfflineNoCache({ what = '数据' }: { what?: string }) {
  return (
    <div className={layout.page + ' flex items-center justify-center'}>
      <div className="max-w-sm px-6 text-center">
        <p className="text-lg font-semibold text-[var(--color-text)]">离线中，暂无可显示的缓存数据</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {what}需要先联网加载一次，之后才能离线查看。恢复联网后会自动加载。
        </p>
      </div>
    </div>
  );
}
