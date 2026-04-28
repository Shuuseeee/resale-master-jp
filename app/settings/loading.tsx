export default function SettingsLoading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      <div className="h-7 w-16 bg-apple-gray-5 dark:bg-white/10 rounded mb-6" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-apple-gray-5 dark:bg-white/10 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
