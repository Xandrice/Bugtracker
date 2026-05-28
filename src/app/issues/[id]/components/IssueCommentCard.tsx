"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Loader2, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, Button } from "@heroui/react";
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
            <Avatar className="h-8 w-8 text-xs font-semibold shrink-0 border border-primary/20">
                {note.author.image && <Avatar.Image src={note.author.image} className="object-cover h-full w-full" />}
                <Avatar.Fallback>{(note.author.name || "U").charAt(0).toUpperCase()}</Avatar.Fallback>
            </Avatar>
            <div className="min-w-0 flex-1 rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-default-100 px-3.5 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-foreground truncate">
                            {note.author.name || "Unknown"}
                        </span>
                        {isDiscord && (
                            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                Discord
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <span
                            className="text-[11px] text-default-450 font-medium"
                            title={note.createdAt}
                        >
                            {formatDate(note.createdAt)}
                        </span>
                        {!editing && canEdit && (
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="text-default-400 transition-colors hover:text-foreground cursor-pointer"
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
                                    className="text-default-400 transition-colors hover:text-danger disabled:opacity-50 cursor-pointer"
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
                        <textarea
                            name="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={4}
                            required
                            className="block w-full resize-y bg-transparent p-2.5 text-sm text-foreground placeholder:text-default-400 border border-default-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none rounded-lg transition-all min-h-[90px]"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setContent(note.content);
                                    setEditing(false);
                                }}
                                isDisabled={saving}
                                className="font-semibold text-xs h-8"
                            >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                variant="primary"
                                isDisabled={saving || !content.trim() || content === note.content}
                                className="font-semibold text-xs h-8"
                            >
                                {saving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Check className="h-3.5 w-3.5" />
                                )}
                                Save
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none px-3.5 py-2.5 text-sm prose-p:my-1 prose-pre:my-2 prose-code:before:content-[''] prose-code:after:content-['']">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {note.content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}
