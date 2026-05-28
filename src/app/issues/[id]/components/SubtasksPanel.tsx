"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import {
    PRIORITY_OPTIONS,
    STATUS_META,
    TYPE_OPTIONS,
    type IssuePriority,
    type IssueStatus,
    type IssueType,
} from "@/lib/issue-tokens";
import { createSubtask, unlinkSubtask } from "@/app/actions";

export type SubtaskRow = {
    id: string;
    issueRef: string;
    title: string;
    status: IssueStatus;
    priority: IssuePriority;
    type: IssueType;
};

export function SubtasksPanel({
    parentIssueId,
    subtasks,
    canEdit,
}: {
    parentIssueId: string;
    subtasks: SubtaskRow[];
    canEdit: boolean;
}) {
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState("");
    const [type, setType] = useState<string>("TASK");
    const [priority, setPriority] = useState<string>("MEDIUM");
    const [submitting, setSubmitting] = useState(false);

    const total = subtasks.length;
    const done = subtasks.filter((s) => s.status === "DONE").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className="rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Subtasks</span>
                    {total > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                            {done}/{total} · {pct}%
                        </span>
                    )}
                </div>
                {canEdit && !adding && (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 h-6 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <Plus className="h-3 w-3" />
                        Add
                    </button>
                )}
            </div>

            {total > 0 && (
                <div className="px-3 pt-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="divide-y divide-border">
                {subtasks.length === 0 && !adding && (
                    <p className="px-3 py-4 text-xs text-subtle-foreground">No subtasks yet.</p>
                )}
                {subtasks.map((s) => {
                    const meta = STATUS_META[s.status];
                    return (
                        <div
                            key={s.id}
                            className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/40"
                        >
                            <span
                                className={cn(
                                    "shrink-0",
                                    s.status === "DONE" ? "text-success" : "text-muted-foreground"
                                )}
                            >
                                {meta.icon}
                            </span>
                            <Link
                                href={`/issues/${s.issueRef}`}
                                className={cn(
                                    "min-w-0 flex-1 truncate text-xs text-foreground hover:text-primary",
                                    s.status === "DONE" && "line-through text-muted-foreground"
                                )}
                            >
                                <span className="mr-1.5 font-mono text-[10px] text-subtle-foreground">
                                    {s.issueRef}
                                </span>
                                {s.title}
                            </Link>
                            {canEdit && (
                                <form action={unlinkSubtask}>
                                    <input type="hidden" name="subtaskId" value={s.id} />
                                    <input
                                        type="hidden"
                                        name="parentIssueId"
                                        value={parentIssueId}
                                    />
                                    <button
                                        type="submit"
                                        className="text-subtle-foreground transition-colors hover:text-danger"
                                        title="Unlink"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </form>
                            )}
                        </div>
                    );
                })}
            </div>

            {adding && (
                <form
                    action={async (formData) => {
                        setSubmitting(true);
                        try {
                            await createSubtask(formData);
                            setTitle("");
                            setAdding(false);
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                    className="space-y-2 border-t border-border bg-surface-2 p-3"
                >
                    <input type="hidden" name="parentIssueId" value={parentIssueId} />
                    <Input
                        name="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Subtask title"
                        autoFocus
                        required
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Select
                            name="type"
                            value={type}
                            onChange={setType}
                            options={TYPE_OPTIONS}
                            size="xs"
                        />
                        <Select
                            name="priority"
                            value={priority}
                            onChange={setPriority}
                            options={PRIORITY_OPTIONS}
                            size="xs"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                                setAdding(false);
                                setTitle("");
                            }}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="xs"
                            variant="primary"
                            disabled={submitting || !title.trim()}
                        >
                            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                            Add subtask
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
