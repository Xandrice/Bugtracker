export default function LoadingPage() {
  return <div role="status" aria-live="polite" className="space-y-4 p-8"><p className="text-muted-foreground">Loading…</p><div className="h-8 w-1/3 animate-pulse rounded bg-muted" /><div className="h-40 animate-pulse rounded bg-muted" /></div>;
}
