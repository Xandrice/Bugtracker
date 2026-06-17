import { cn } from "../ui/cn";
import type { LabeledValue } from "@/lib/fivem-db";

function looksLikeId(value: string): boolean {
  return /^[0-9a-f]{6,}$/i.test(value) || /^[A-Z0-9]{6,}$/.test(value) || value.includes(":");
}

function looksLikeNumber(value: string): boolean {
  return /^[-+$]?[\d,]+(\.\d+)?%?$/.test(value.trim());
}

export function DataList({
  items,
  className,
  emptyLabel = "No data available.",
}: {
  items: LabeledValue[];
  className?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-0.5 border-b border-border/60 pb-2 last:border-b-0"
        >
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </dt>
          <dd
            className={cn(
              "text-sm text-foreground break-words",
              looksLikeNumber(item.value) && "tabular-nums",
              looksLikeId(item.value) && "font-mono text-xs"
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Recursive renderer for arbitrary nested values so leftover JSON is shown as
// labelled rows rather than a stringified blob.
export function DataValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">Empty</span>;
    return (
      <ul className="space-y-1">
        {value.map((entry, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-[10px] text-muted-foreground tabular-nums">{index}</span>
            <DataValue value={entry} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">Empty</span>;
    return (
      <div className={cn("space-y-1", depth > 0 && "border-l border-border/60 pl-3")}>
        {entries.map(([key, entry]) => (
          <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <span className="min-w-[140px] text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {key}
            </span>
            <div className="text-sm text-foreground break-words">
              <DataValue value={entry} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "boolean") {
    return <span className="text-foreground">{value ? "Yes" : "No"}</span>;
  }

  return <span className="text-foreground break-words">{String(value)}</span>;
}
