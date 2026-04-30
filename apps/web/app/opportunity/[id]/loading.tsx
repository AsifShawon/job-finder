export default function LoadingOpportunity() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-8 w-4/5 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </main>
  );
}
