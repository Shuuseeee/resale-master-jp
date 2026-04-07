export default function TransactionsLoading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      {/* 标题 + 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      {/* 状态标签栏 */}
      <div className="flex gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        ))}
      </div>
      {/* 卡片列表 */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
