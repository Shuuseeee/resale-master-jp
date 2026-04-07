export default function AnalyticsLoading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}
