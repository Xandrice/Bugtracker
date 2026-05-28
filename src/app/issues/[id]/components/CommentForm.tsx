"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { createTeamNote } from "@/app/actions";
import { Avatar, Button } from "@heroui/react";
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
            <Avatar className="h-8 w-8 text-xs font-semibold shrink-0 border border-primary/20">
                {currentUserImage && <Avatar.Image src={currentUserImage} className="object-cover h-full w-full" />}
                <Avatar.Fallback>Y</Avatar.Fallback>
            </Avatar>
            <div className="relative flex-1 min-w-0 overflow-visible rounded-xl border border-default-200 bg-background/50 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                {showMentions && filteredUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 z-50 mb-1 flex max-h-[200px] w-64 flex-col overflow-y-auto rounded-xl border border-default-100 bg-background/95 backdrop-blur-md p-1 shadow-lg">
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
                                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                                    idx === selectedIndex
                                        ? "bg-primary text-primary-foreground font-semibold"
                                        : "text-foreground hover:bg-default-100"
                                )}
                            >
                                <Avatar className="h-5 w-5 text-[9px]">
                                    {user.image && <Avatar.Image src={user.image} className="object-cover h-full w-full" />}
                                    <Avatar.Fallback>{(user.name || "U").charAt(0).toUpperCase()}</Avatar.Fallback>
                                </Avatar>
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
                    className="block w-full resize-y bg-transparent p-3.5 text-sm text-foreground placeholder:text-default-400 focus:outline-none min-h-[90px]"
                    disabled={isPending}
                />
                <div className="flex items-center justify-between border-t border-default-100 bg-default-50/10 px-3 py-2 rounded-b-xl">
                    <span className="px-1 text-[10px] text-default-450 font-medium">
                        Tip: <kbd className="rounded border border-default-200 bg-default-150 px-1 font-semibold">@</kbd> to mention
                    </span>
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="font-semibold shadow-sm flex items-center justify-center gap-1.5"
                        isDisabled={isPending || !content.trim()}
                    >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {isPending ? "Sending…" : "Comment"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
