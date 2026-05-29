"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { globalSearch } from "@/app/staff-actions";

type SearchResults = Awaited<ReturnType<typeof globalSearch>>;

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSearch = useCallback((value: string) => {
    startTransition(async () => {
      const data = await globalSearch(value);
      setResults(data);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) runSearch(query);
      else setResults(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, runSearch]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-elevated shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, docs, members…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
          />
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2 text-sm">
          {!query.trim() && (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          )}

          {results && results.issues.length > 0 && (
            <section className="mb-3">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Issues
              </h3>
              {results.issues.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {item.ref}
                  </span>{" "}
                  {item.title}
                </Link>
              ))}
            </section>
          )}

          {results && results.notes.length > 0 && (
            <section className="mb-3">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Docs / notes
              </h3>
              {results.notes.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  {item.title}
                </Link>
              ))}
            </section>
          )}

          {results && results.members.length > 0 && (
            <section>
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Members
              </h3>
              {results.members.map((item: { id: string; discordId: string; role: string; href: string }) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  {item.discordId} · {item.role}
                </Link>
              ))}
            </section>
          )}

          {query.trim().length >= 2 &&
            results &&
            results.issues.length === 0 &&
            results.notes.length === 0 &&
            results.members.length === 0 &&
            !isPending && (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

export function GlobalSearchTrigger() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <GlobalSearchDialog />;
}
