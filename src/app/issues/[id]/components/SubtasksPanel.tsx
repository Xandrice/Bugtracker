"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, Loader2 } from "lucide-react";
import {
    Button,
    Input,
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownMenu,
    DropdownItem,
    buttonVariants,
} from "@heroui/react";
import { cn } from "@/components/ui/cn";
import {
    PRIORITY_OPTIONS,
    PRIORITY_META,
    STATUS_META,
    TYPE_OPTIONS,
    TYPE_META,
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
        <div className="rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-default-100 px-3.5 py-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider text-default-450">Subtasks</span>
                    {total > 0 && (
                        <span className="text-[11px] font-semibold text-default-450 bg-default-100/50 px-1.5 py-0.5 rounded-full">
                            {done}/{total} · {pct}%
                        </span>
                    )}
                </div>
                {canEdit && !adding && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setAdding(true)}
                        className="h-6 min-w-0 px-2 text-[11px] font-semibold text-default-500 hover:text-foreground"
                    >
                        <Plus className="h-3 w-3 mr-0.5" />
                        Add
                    </Button>
                )}
            </div>

            {total > 0 && (
                <div className="px-3.5 pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-100">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="divide-y divide-default-100">
                {subtasks.length === 0 && !adding && (
                    <p className="px-3.5 py-4 text-xs font-medium text-default-455">No subtasks yet.</p>
                )}
                {subtasks.map((s) => {
                    const meta = STATUS_META[s.status];
                    return (
                        <div
                            key={s.id}
                            className="flex items-center gap-2 px-3.5 py-2 transition-colors hover:bg-default-50/50"
                        >
                            <span
                                className={cn(
                                    "shrink-0",
                                    s.status === "DONE" ? "text-success" : "text-default-400"
                                )}
                            >
                                {meta.icon}
                            </span>
                            <Link
                                href={`/issues/${s.issueRef}`}
                                className={cn(
                                    "min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:text-primary transition-colors",
                                    s.status === "DONE" && "line-through text-default-400 font-medium"
                                )}
                            >
                                <span className="mr-1.5 font-mono text-[10px] text-default-450">
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
                                        className="text-default-400 transition-colors hover:text-danger p-0.5 rounded"
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
                    className="space-y-3 border-t border-default-100 bg-default-50/20 p-3.5"
                >
                    <input type="hidden" name="parentIssueId" value={parentIssueId} />
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="priority" value={priority} />

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-default-450">Title</span>
                        <Input
                            name="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Subtask title"
                            autoFocus
                            required
                            className="w-full h-8 px-2.5 bg-background/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-xs text-foreground transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {/* Type */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-default-450">Type</span>
                            <Dropdown>
                                <DropdownTrigger
                                    className={cn(
                                        buttonVariants({ variant: "outline", size: "sm" }),
                                        "w-full h-8 justify-between px-2 text-xs border-default-200 hover:border-default-400 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        {TYPE_META[type as IssueType]?.icon}
                                        {TYPE_META[type as IssueType]?.label}
                                    </span>
                                </DropdownTrigger>
                                <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                    <DropdownMenu
                                        aria-label="Select Type"
                                        selectionMode="single"
                                        selectedKeys={new Set([type])}
                                        onSelectionChange={(keys) => setType(Array.from(keys)[0] as string)}
                                    >
                                        {TYPE_OPTIONS.map((opt) => (
                                            <DropdownItem key={opt.value}>
                                                <span className="flex items-center gap-2">
                                                    {opt.icon}
                                                    {opt.label}
                                                </span>
                                            </DropdownItem>
                                        ))}
                                    </DropdownMenu>
                                </DropdownPopover>
                            </Dropdown>
                        </div>

                        {/* Priority */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-default-450">Priority</span>
                            <Dropdown>
                                <DropdownTrigger
                                    className={cn(
                                        buttonVariants({ variant: "outline", size: "sm" }),
                                        "w-full h-8 justify-between px-2 text-xs border-default-200 hover:border-default-400 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        {PRIORITY_META[priority as IssuePriority]?.icon}
                                        {PRIORITY_META[priority as IssuePriority]?.label}
                                    </span>
                                </DropdownTrigger>
                                <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                    <DropdownMenu
                                        aria-label="Select Priority"
                                        selectionMode="single"
                                        selectedKeys={new Set([priority])}
                                        onSelectionChange={(keys) => setPriority(Array.from(keys)[0] as string)}
                                    >
                                        {PRIORITY_OPTIONS.map((opt) => (
                                            <DropdownItem key={opt.value}>
                                                <span className="flex items-center gap-2">
                                                    {opt.icon}
                                                    {opt.label}
                                                </span>
                                            </DropdownItem>
                                        ))}
                                    </DropdownMenu>
                                </DropdownPopover>
                            </Dropdown>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onPress={() => {
                                setAdding(false);
                                setTitle("");
                            }}
                            isDisabled={submitting}
                            className="h-7 text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            variant="primary"
                            isDisabled={submitting || !title.trim()}
                            className="h-7 text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
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
