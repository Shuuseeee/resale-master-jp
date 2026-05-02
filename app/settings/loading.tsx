export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:px-6">
      <div className="mx-auto max-w-4xl animate-pulse">
        <div className="mb-6 h-7 w-16 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
              <div>
                <div className="mb-2 h-4 w-28 rounded bg-[var(--color-bg-subtle)]" />
                <div className="h-3 w-40 rounded bg-[var(--color-bg-subtle)]" />
              </div>
              <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
