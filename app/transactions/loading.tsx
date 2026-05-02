export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:px-6">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-7 w-24 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
          <div className="h-10 w-24 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        </div>
        <div className="mb-4 flex gap-2 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-20 flex-shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
          ))}
        </div>
        <div className="space-y-3 lg:hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-4 flex gap-3">
                <div className="h-14 w-14 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-3/4 rounded bg-[var(--color-bg-subtle)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--color-bg-subtle)]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 rounded bg-[var(--color-bg-subtle)]" />
                <div className="h-8 rounded bg-[var(--color-bg-subtle)]" />
                <div className="h-8 rounded bg-[var(--color-bg-subtle)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-sm)] lg:block">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] p-4 last:border-b-0">
              {[...Array(6)].map((__, j) => (
                <div key={j} className="h-4 rounded bg-[var(--color-bg-subtle)]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
