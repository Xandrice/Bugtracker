"use client";

import { useState, useRef, useEffect, TextareaHTMLAttributes } from "react";
import { UserCircle2 } from "lucide-react";
import { getMentionableUsers } from "@/app/actions";

interface User {
    id: string;
    name: string | null;
    image: string | null;
}

interface MentionTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    wrapperClassName?: string;
}

export function MentionTextarea({ wrapperClassName = "", ...props }: MentionTextareaProps) {
    const [content, setContent] = useState(props.defaultValue as string || props.value as string || "");
    const [mentionFilter, setMentionFilter] = useState("");
    const [showMentions, setShowMentions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [users, setUsers] = useState<User[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        getMentionableUsers().then(fetchedUsers => {
            setUsers(fetchedUsers);
        }).catch(err => {
            console.error("Failed to load users for mentions", err);
        });
    }, []);

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
        }

        if (props.onKeyDown) {
            props.onKeyDown(e);
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

        if (props.onChange) {
            props.onChange(e);
        }
    };

    const insertMention = (name: string) => {
        const cursor = textareaRef.current?.selectionEnd || 0;
        const textBeforeCursor = content.slice(0, cursor);
        const textAfterCursor = content.slice(cursor);

        const match = textBeforeCursor.match(/@([\w]*)$/);
        if (match) {
            const safeName = name.replace(/\s+/g, "");

            const newTextBefore = textBeforeCursor.slice(0, match.index) + `@${safeName} `;
            const newContent = newTextBefore + textAfterCursor;
            setContent(newContent);

            // For uncontrolled forms mapping directly to elements, we must sync the actual DOM value.
            if (textareaRef.current) {
                textareaRef.current.value = newContent;
            }

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

    return (
        <div className={`relative ${wrapperClassName}`}>
            {showMentions && filteredUsers.length > 0 && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-[200px] overflow-y-auto p-1">
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
                {...props}
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
}
