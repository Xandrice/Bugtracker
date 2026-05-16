"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { createTeamNote } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

interface User {
    id: string;
    name: string | null;
    image: string | null;
}

export default function CommentForm({
    issueId,
    currentUserImage,
    users,
}: {
    issueId: string;
    currentUserImage: string | null;
    users: User[];
}) {
    const [content, setContent] = useState("");
    const [mentionFilter, setMentionFilter] = useState("");
    const [showMentions, setShowMentions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isPending, setIsPending] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const filteredUsers = users.filter(
        (u) => u.name && u.name.toLowerCase().includes(mentionFilter.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showMentions && filteredUsers.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => (i + 1) % filteredUsers.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(filteredUsers[selectedIndex].name!);
            } else if (e.key === "Escape") {
                setShowMentions(false);
                e.preventDefault();
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);

        const cursor = e.target.selectionEnd || 0;
        const textBeforeCursor = val.slice(0, cursor);
        const match = textBeforeCursor.match(/@([\w]*)$/);

        if (match) {
            setShowMentions(true);
            setMentionFilter(match[1]);
            setSelectedIndex(0);
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = (name: string) => {
        const cursor = textareaRef.current?.selectionEnd || 0;
        const textBeforeCursor = content.slice(0, cursor);
        const textAfterCursor = content.slice(cursor);

        const match = textBeforeCursor.match(/@([\w]*)$/);
        if (match) {
            const safeName = name.replace(/\s+/g, "");
            const newTextBefore =
                textBeforeCursor.slice(0, match.index) + `@${safeName} `;
            setContent(newTextBefore + textAfterCursor);

            const newCursor = newTextBefore.length;
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = newCursor;
                    textareaRef.current.selectionEnd = newCursor;
                    textareaRef.current.focus();
                }
            }, 0);
        }
        setShowMentions(false);
    };

    const handleAction = async (formData: FormData) => {
        setIsPending(true);
        try {
            await createTeamNote(formData);
            setContent("");
            setShowMentions(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <form action={handleAction} className="flex items-start gap-3 pt-3">
            <input type="hidden" name="issueId" value={issueId} />
            <Avatar src={currentUserImage} size="md" name="You" />
            <div className="relative flex-1 min-w-0 overflow-visible rounded-md border border-input bg-elevated focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 transition-colors">
                {showMentions && filteredUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 z-50 mb-1 flex max-h-[200px] w-64 flex-col overflow-y-auto rounded-md border border-border bg-elevated p-1 shadow-pop">
                        {filteredUsers.map((user, idx) => (
                            <button
                                type="button"
                                key={user.id}
                                onClick={(e) => {
                                    e.preventDefault();
                                    insertMention(user.name!);
                                }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors",
                                    idx === selectedIndex
                                        ? "bg-primary text-primary-foreground"
                                        : "text-foreground hover:bg-muted"
                                )}
                            >
                                <Avatar src={user.image} name={user.name} size="xs" />
                                <span className="truncate">{user.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    name="content"
                    required
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment… Markdown supported. Use @ to mention people."
                    className="block w-full resize-y bg-transparent p-3 text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none min-h-[90px]"
                    disabled={isPending}
                />
                <div className="flex items-center justify-between border-t border-border bg-surface-2 px-2 py-1.5">
                    <span className="px-1 text-[10px] text-subtle-foreground">
                        Tip: <kbd className="rounded border border-border bg-surface px-1">@</kbd> to mention
                    </span>
                    <Button
                        type="submit"
                        variant="primary"
                        size="xs"
                        disabled={isPending || !content.trim()}
                    >
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        {isPending ? "Sending…" : "Comment"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
