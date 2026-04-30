export default function LoadingSearch() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="h-8 w-64 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="hidden rounded-2xl border border-border bg-card p-5 lg:block">
          <div className="space-y-4">
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mt-5 h-10 w-40 animate-pulse rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
