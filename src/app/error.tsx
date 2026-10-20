"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-lg space-y-4 p-8"><h1 className="text-xl font-semibold">We couldn’t load this page</h1><p className="text-muted-foreground">Please try again. If this keeps happening, contact an administrator.</p><button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={reset}>Retry</button></div>;
}
