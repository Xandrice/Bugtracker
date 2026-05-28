"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, Plus, X, Loader2 } from "lucide-react";
import {
    Button,
    Input,
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownMenu,
    DropdownItem,
    buttonVariants,
    cn,
} from "@heroui/react";
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
        <div className="rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-default-100 px-3.5 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider text-default-450">
                    <Link2 className="h-3.5 w-3.5" />
                    Linked issues
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

            <div className="divide-y divide-default-100">
                {links.length === 0 && !adding && (
                    <p className="px-3.5 py-4 text-xs font-medium text-default-450">No linked issues.</p>
                )}
                {grouped.map(
                    (g) =>
                        g.items.length > 0 && (
                            <div key={g.type} className="p-3">
                                <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-default-450">
                                    {g.label}
                                </div>
                                <div className="space-y-1">
                                    {g.items.map((l) => {
                                        const meta = STATUS_META[l.targetStatus];
                                        return (
                                            <div
                                                key={l.linkId}
                                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-default-50/50"
                                            >
                                                <span className="shrink-0 text-default-400">
                                                    {meta.icon}
                                                </span>
                                                <Link
                                                    href={`/issues/${l.targetIssueRef}`}
                                                    className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:text-primary transition-colors"
                                                >
                                                    <span className="mr-1.5 font-mono text-[10px] text-default-450">
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
                                                            className="text-default-400 transition-colors hover:text-danger p-0.5 rounded"
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
                    className="space-y-3 border-t border-default-100 bg-default-50/20 p-3.5"
                >
                    <input type="hidden" name="sourceId" value={sourceId} />
                    <input type="hidden" name="linkType" value={linkType} />
                    
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-default-450">Relationship</span>
                        <Dropdown>
                            <DropdownTrigger
                                className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "w-full h-8 justify-between px-2.5 text-xs border-default-200 hover:border-default-400 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                )}
                            >
                                <span>{LINK_TYPE_OPTIONS.find(o => o.value === linkType)?.label || linkType}</span>
                            </DropdownTrigger>
                            <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                <DropdownMenu
                                    aria-label="Select Link Type"
                                    selectionMode="single"
                                    selectedKeys={new Set([linkType])}
                                    onSelectionChange={(keys) => setLinkType(Array.from(keys)[0] as string)}
                                >
                                    {LINK_TYPE_OPTIONS.map((opt) => (
                                        <DropdownItem key={opt.value}>
                                            {opt.label}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </DropdownPopover>
                        </Dropdown>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-default-455">Target Issue</span>
                        <Input
                            name="targetRef"
                            value={targetRef}
                            onChange={(e) => setTargetRef(e.target.value)}
                            placeholder="Issue key (e.g. k7m3qp2a)"
                            autoFocus
                            required
                            className="w-full h-8 px-2.5 bg-background/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-xs text-foreground transition-all font-mono"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onPress={() => {
                                setAdding(false);
                                setTargetRef("");
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
                            isDisabled={submitting || !targetRef.trim()}
                            className="h-7 text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
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
