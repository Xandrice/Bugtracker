"use client";

import { ChevronDown } from "lucide-react";
import type { IssueAssigneeUser } from "@/lib/issue-assignees";

export function AssigneePicker({ users, value, onChange, label = "Assignees", disabled = false }: {
  users: IssueAssigneeUser[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  disabled?: boolean;
}) {
  const options = new Map(users.map(user => [user.id, user]));
  for (const id of value) if (!options.has(id)) options.set(id, { id, name: id });
  const selectedNames = value.map(id => options.get(id)?.name || id).join(", ");

  return <details className="relative min-w-0 max-w-xs">
    <summary
      aria-label={label}
      aria-disabled={disabled}
      onClick={event => { if (disabled) event.preventDefault(); }}
      className={`flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-elevated px-2 py-1 text-xs text-foreground focus-ring ${disabled ? "cursor-wait opacity-50" : ""}`}
    >
      <span className="min-w-0 flex-1 break-words">{selectedNames || "Unassigned"}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
    </summary>
    <div className="mt-1 w-60 max-w-[calc(100vw-3rem)] rounded-md border border-border bg-surface p-2">
      <fieldset disabled={disabled} className="max-h-56 space-y-1 overflow-y-auto">
        <legend className="sr-only">{label}</legend>
        {[...options.values()].map(user => <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
          <input type="checkbox" className="accent-primary" checked={value.includes(user.id)} onChange={event => onChange(event.target.checked ? [...value, user.id] : value.filter(id => id !== user.id))} />
          <span className="break-words">{user.name || user.id}</span>
        </label>)}
        {options.size === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No people available.</p>}
      </fieldset>
      <button type="button" disabled={disabled || value.length === 0} onClick={() => onChange([])} className="mt-2 rounded px-2 py-1 text-xs text-primary underline focus-ring disabled:opacity-50">Clear assignees</button>
    </div>
  </details>;
}
