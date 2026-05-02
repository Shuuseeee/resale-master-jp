export default function CouponsLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:px-6">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-7 w-16 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
          <div className="h-10 w-20 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="h-4 w-36 rounded bg-[var(--color-bg-subtle)]" />
                <div className="h-6 w-16 rounded-full bg-[var(--color-bg-subtle)]" />
              </div>
              <div className="h-3 w-2/3 rounded bg-[var(--color-bg-subtle)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
