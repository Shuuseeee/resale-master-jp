export default function SuppliesLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:px-6">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-7 w-24 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
          <div className="h-10 w-20 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 h-4 w-36 rounded bg-[var(--color-bg-subtle)]" />
              <div className="flex items-center justify-between gap-4">
                <div className="h-3 w-28 rounded bg-[var(--color-bg-subtle)]" />
                <div className="h-5 w-16 rounded bg-[var(--color-bg-subtle)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
