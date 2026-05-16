"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createIssueLink, deleteIssueLink } from "@/app/actions";
import {
    LINK_TYPE_META,
    LINK_TYPE_OPTIONS,
    STATUS_META,
    type IssueLinkType,
    type IssueStatus,
} from "@/lib/issue-tokens";

export type LinkedIssueRow = {
    linkId: string;
    type: IssueLinkType;
    targetId: string;
    targetIssueRef: string;
    targetTitle: string;
    targetStatus: IssueStatus;
};

export function IssueLinksPanel({
    sourceId,
    links,
    canEdit,
}: {
    sourceId: string;
    links: LinkedIssueRow[];
    canEdit: boolean;
}) {
    const [adding, setAdding] = useState(false);
    const [linkType, setLinkType] = useState<string>("BLOCKS");
    const [targetRef, setTargetRef] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // group by relationship type
    const grouped = (Object.keys(LINK_TYPE_META) as IssueLinkType[]).map((t) => ({
        type: t,
        label: LINK_TYPE_META[t].label,
        items: links.filter((l) => l.type === t),
    }));

    return (
        <div className="rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Linked issues
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

            <div className="divide-y divide-border">
                {links.length === 0 && !adding && (
                    <p className="px-3 py-4 text-xs text-subtle-foreground">No linked issues.</p>
                )}
                {grouped.map(
                    (g) =>
                        g.items.length > 0 && (
                            <div key={g.type} className="p-2">
                                <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-subtle-foreground">
                                    {g.label}
                                </div>
                                <div className="space-y-1">
                                    {g.items.map((l) => {
                                        const meta = STATUS_META[l.targetStatus];
                                        return (
                                            <div
                                                key={l.linkId}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                                            >
                                                <span className="shrink-0 text-muted-foreground">
                                                    {meta.icon}
                                                </span>
                                                <Link
                                                    href={`/issues/${l.targetIssueRef}`}
                                                    className="min-w-0 flex-1 truncate text-xs text-foreground hover:text-primary"
                                                >
                                                    <span className="mr-1.5 font-mono text-[10px] text-subtle-foreground">
                                                        {l.targetIssueRef}
                                                    </span>
                                                    {l.targetTitle}
                                                </Link>
                                                {canEdit && (
                                                    <form action={deleteIssueLink}>
                                                        <input type="hidden" name="linkId" value={l.linkId} />
                                                        <input type="hidden" name="sourceId" value={sourceId} />
                                                        <button
                                                            type="submit"
                                                            className="text-subtle-foreground transition-colors hover:text-danger"
                                                            title="Remove link"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </form>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                )}
            </div>

            {adding && (
                <form
                    action={async (formData) => {
                        setSubmitting(true);
                        try {
                            await createIssueLink(formData);
                            setTargetRef("");
                            setAdding(false);
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                    className="space-y-2 border-t border-border bg-surface-2 p-3"
                >
                    <input type="hidden" name="sourceId" value={sourceId} />
                    <Select
                        name="linkType"
                        value={linkType}
                        onChange={setLinkType}
                        options={LINK_TYPE_OPTIONS}
                        size="xs"
                    />
                    <Input
                        name="targetRef"
                        value={targetRef}
                        onChange={(e) => setTargetRef(e.target.value)}
                        placeholder="Issue ref or # (e.g. RR-12)"
                        autoFocus
                        required
                    />
                    <div className="flex items-center justify-end gap-1.5">
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                                setAdding(false);
                                setTargetRef("");
                            }}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="xs"
                            variant="primary"
                            disabled={submitting || !targetRef.trim()}
                        >
                            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                            Link
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
