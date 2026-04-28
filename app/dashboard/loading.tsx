export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      {/* 标题 */}
      <div className="h-7 w-32 bg-apple-gray-5 dark:bg-white/10 rounded mb-6" />
      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-apple-gray-5 dark:bg-white/10 rounded-xl" />
        ))}
      </div>
      {/* 内容块 */}
      <div className="space-y-3">
        <div className="h-40 bg-apple-gray-5 dark:bg-white/10 rounded-xl" />
        <div className="h-40 bg-apple-gray-5 dark:bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}
