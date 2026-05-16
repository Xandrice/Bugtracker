"use client";

import { Bell, Check, ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions";
import { cn } from "@/components/ui/cn";

type NotificationItem = {
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    readAt: string | null;
    createdAt: string;
};

function formatRelative(iso: string) {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

export function NotificationBell({ unread: initialUnread }: { unread: number }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[] | null>(null);
    const [unread, setUnread] = useState(initialUnread);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open || items !== null) return;
        setLoading(true);
        getMyNotifications()
            .then((data) => {
                setItems(
                    data.map((n: any) => ({
                        ...n,
                        readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
                        createdAt: new Date(n.createdAt).toISOString(),
                    }))
                );
            })
            .finally(() => setLoading(false));
    }, [open, items]);

    const handleMarkAll = async () => {
        await markAllNotificationsRead();
        setUnread(0);
        setItems((prev) =>
            prev?.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })) ?? prev
        );
    };

    const handleClickItem = async (item: NotificationItem) => {
        if (!item.readAt) {
            await markNotificationRead(item.id);
            setUnread((u) => Math.max(0, u - 1));
            setItems(
                (prev) =>
                    prev?.map((n) =>
                        n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
                    ) ?? prev
            );
        }
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "relative inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    open && "bg-muted text-foreground"
                )}
                aria-label="Notifications"
            >
                <Bell className="h-3.5 w-3.5" />
                {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-elevated shadow-pop overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <span className="text-xs font-semibold text-foreground">Inbox</span>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAll}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                                <Check className="h-3 w-3" />
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                                Loading…
                            </div>
                        ) : !items || items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 px-3 py-10 text-center">
                                <Inbox className="h-6 w-6 text-subtle-foreground" />
                                <div className="text-xs text-muted-foreground">
                                    You're all caught up.
                                </div>
                            </div>
                        ) : (
                            items.map((item) => {
                                const content = (
                                    <div
                                        className={cn(
                                            "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted",
                                            !item.readAt && "bg-primary/5"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                                                !item.readAt ? "bg-primary" : "bg-transparent"
                                            )}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-medium text-foreground truncate">
                                                {item.title}
                                            </div>
                                            {item.body && (
                                                <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                                                    {item.body}
                                                </div>
                                            )}
                                            <div className="mt-1 text-[10px] text-subtle-foreground">
                                                {formatRelative(item.createdAt)}
                                            </div>
                                        </div>
                                        {item.link && (
                                            <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-subtle-foreground" />
                                        )}
                                    </div>
                                );

                                if (item.link) {
                                    return (
                                        <Link
                                            key={item.id}
                                            href={item.link}
                                            onClick={() => handleClickItem(item)}
                                            className="block border-b border-border last:border-b-0"
                                        >
                                            {content}
                                        </Link>
                                    );
                                }
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleClickItem(item)}
                                        className="block w-full border-b border-border last:border-b-0"
                                    >
                                        {content}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
