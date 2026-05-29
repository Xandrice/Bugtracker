"use client";

import { Search } from "lucide-react";

export function SearchTriggerButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        )
      }
      className="relative flex h-7 w-full items-center rounded-md border border-input bg-elevated pl-8 pr-2 text-left text-xs text-subtle-foreground transition-colors hover:border-border-strong"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
      <span>Search issues, docs, members…</span>
      <kbd className="absolute right-1.5 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center rounded border border-border bg-surface-2 px-1 text-[10px] font-medium text-subtle-foreground sm:inline-flex">
        ⌘K
      </kbd>
    </button>
  );
}
