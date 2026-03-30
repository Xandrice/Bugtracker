"use client";

import { useState, useRef, useEffect } from "react";
import { UserCircle2, Paperclip, Link as LinkIcon, Send } from "lucide-react";
import { createTeamNote } from "@/app/actions";

interface User {
    id: string;
    name: string | null;
    image: string | null;
}

export default function CommentForm({
    issueId,
    currentUserImage,
    users
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

    const filteredUsers = users.filter(u =>
        u.name && u.name.toLowerCase().includes(mentionFilter.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showMentions && filteredUsers.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(i => (i + 1) % filteredUsers.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(i => (i - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(filteredUsers[selectedIndex].name!);
            } else if (e.key === "Escape") {
                setShowMentions(false);
                e.preventDefault();
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            // Optional: submit on Enter without shift
            // e.preventDefault();
            // textareaRef.current?.form?.requestSubmit();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);

        // Check for active mention at cursor
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
            // we use the actual name but replace spaces with underscores or just strip it.
            // But BugTracker might not handle spaces in tags properly with `@` currently since the regex was /@(\w+)/g
            // Let's ensure the tag format matches (safe alphanumeric). Wait, \w allows letters, numbers, underscores.
            // If the user's name has spaces, we should format the name to match \w or fix the regex.
            // Let's format it for safe tagging, removing spaces.
            const safeName = name.replace(/\s+/g, "");

            const newTextBefore = textBeforeCursor.slice(0, match.index) + `@${safeName} `;
            setContent(newTextBefore + textAfterCursor);

            // Move cursor to after the inserted mention
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
        <form action={handleAction} className="flex gap-4 mt-6 items-start pt-6 border-t border-border">
            <input type="hidden" name="issueId" value={issueId} />
            <div className="shrink-0 mt-1">
                {currentUserImage ? (
                    <img src={currentUserImage} alt="You" className="w-8 h-8 rounded-full border object-cover" />
                ) : (
                    <UserCircle2 className="w-8 h-8 text-muted-foreground" />
                )}
            </div>
            <div className="flex-1 border border-border rounded-xl shadow-sm bg-background overflow-visible focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 relative">

                {/* Mentions Dropdown */}
                {showMentions && filteredUsers.length > 0 && (
                    <div className="absolute left-0 bottom-full mb-2 w-64 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-[200px] overflow-y-auto p-1">
                        {filteredUsers.map((user, idx) => (
                            <button
                                type="button"
                                key={user.id}
                                onClick={(e) => {
                                    e.preventDefault();
                                    insertMention(user.name!);
                                }}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer w-full ${idx === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                {user.image ? (
                                    <img src={user.image} alt={user.name || "User"} className="w-5 h-5 rounded-full bg-background" />
                                ) : (
                                    <UserCircle2 className="w-5 h-5 opacity-70" />
                                )}
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
                    placeholder="Add a note... Markdown supported (bold, lists, links, code). Use @ to tag people."
                    className="w-full min-h-[100px] p-4 text-sm resize-y focus:outline-none bg-transparent"
                    disabled={isPending}
                />
                <div className="bg-muted/50 px-3 py-2 border-t border-border flex items-center justify-between">
                    <div className="flex gap-2">
                        <button type="button" className="p-1.5 text-muted-foreground hover:bg-muted rounded text-xs transition-colors"><Paperclip className="h-4 w-4" /></button>
                        <button type="button" className="p-1.5 text-muted-foreground hover:bg-muted rounded text-xs transition-colors"><LinkIcon className="h-4 w-4" /></button>
                    </div>
                    <button type="submit" disabled={isPending || !content.trim()} className="bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors">
                        <Send className="h-3.5 w-3.5" /> {isPending ? "Sending..." : "Comment"}
                    </button>
                </div>
            </div>
        </form>
    );
}
