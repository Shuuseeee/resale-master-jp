export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:px-6">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-6 h-7 w-24 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-sm)]">
              <div className="m-4 h-3 w-16 rounded bg-[var(--color-bg-subtle)]" />
              <div className="mx-4 mt-4 h-6 w-20 rounded bg-[var(--color-bg-subtle)]" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-56 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-5 h-4 w-28 rounded bg-[var(--color-bg-subtle)]" />
              <div className="h-40 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
