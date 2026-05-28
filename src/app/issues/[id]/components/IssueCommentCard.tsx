"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Loader2, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { updateIssueComment, deleteIssueComment } from "@/app/actions";

export type IssueCommentItem = {
    id: string;
    content: string;
    createdAt: string;
    source: string;
    author: {
        id: string;
        name: string | null;
        image: string | null;
    };
};

function formatDate(iso: string) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}

export function IssueCommentCard({
    issueId,
    note,
    canManage,
}: {
    issueId: string;
    note: IssueCommentItem;
    canManage: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [content, setContent] = useState(note.content);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isDiscord = note.source === "DISCORD";
    // Discord-sourced notes are mirrors of Discord activity — editing them
    // server-side won't update Discord. Hide edit but allow delete (admin).
    const canEdit = canManage && !isDiscord;
    const canDelete = canManage;

    return (
        <div className="flex gap-3">
            <Avatar src={note.author.image} name={note.author.name} size="md" />
            <div className="min-w-0 flex-1 rounded-md border border-border bg-surface">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                            {note.author.name || "Unknown"}
                        </span>
                        {isDiscord && (
                            <span className="rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-info">
                                Discord
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span
                            className="text-[11px] text-muted-foreground"
                            title={note.createdAt}
                        >
                            {formatDate(note.createdAt)}
                        </span>
                        {!editing && canEdit && (
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="text-subtle-foreground transition-colors hover:text-foreground"
                                title="Edit comment"
                            >
                                <Pencil className="h-3 w-3" />
                            </button>
                        )}
                        {!editing && canDelete && (
                            <form
                                action={async (formData) => {
                                    if (
                                        !window.confirm(
                                            "Delete this comment? This cannot be undone."
                                        )
                                    )
                                        return;
                                    setDeleting(true);
                                    try {
                                        await deleteIssueComment(formData);
                                    } finally {
                                        setDeleting(false);
                                    }
                                }}
                            >
                                <input type="hidden" name="noteId" value={note.id} />
                                <input type="hidden" name="issueId" value={issueId} />
                                <button
                                    type="submit"
                                    disabled={deleting}
                                    className="text-subtle-foreground transition-colors hover:text-danger disabled:opacity-50"
                                    title="Delete comment"
                                >
                                    {deleting ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3 w-3" />
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {editing ? (
                    <form
                        action={async (formData) => {
                            setSaving(true);
                            try {
                                await updateIssueComment(formData);
                                setEditing(false);
                            } finally {
                                setSaving(false);
                            }
                        }}
                        className="space-y-2 px-3 py-2"
                    >
                        <input type="hidden" name="noteId" value={note.id} />
                        <input type="hidden" name="issueId" value={issueId} />
                        <Textarea
                            name="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={4}
                            required
                        />
                        <div className="flex items-center justify-end gap-1.5">
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                    setContent(note.content);
                                    setEditing(false);
                                }}
                                disabled={saving}
                            >
                                <X className="h-3 w-3" />
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="xs"
                                variant="primary"
                                disabled={saving || !content.trim() || content === note.content}
                            >
                                {saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Check className="h-3 w-3" />
                                )}
                                Save
                            </Button>
                        </div>
                    </form>
                ) : (
                    <MarkdownContent content={note.content} className="px-3 py-2" />
                )}
            </div>
        </div>
    );
}
