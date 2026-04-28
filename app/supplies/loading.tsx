export default function SuppliesLoading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-24 bg-apple-gray-5 dark:bg-white/10 rounded" />
        <div className="h-9 w-16 bg-apple-gray-5 dark:bg-white/10 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-apple-gray-5 dark:bg-white/10 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
