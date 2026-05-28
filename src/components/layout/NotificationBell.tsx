"use client";

import { Bell, Check, ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions";
import { cn } from "@/components/ui/cn";
import { Popover, PopoverTrigger, PopoverContent, Button, Badge, BadgeAnchor, BadgeLabel } from "@heroui/react";

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
        <Popover isOpen={open} onOpenChange={setOpen}>
            <PopoverTrigger>
                <div className="relative inline-flex items-center justify-center cursor-pointer">
                    {unread > 0 ? (
                        <Badge color="danger" size="sm">
                            <BadgeAnchor>
                                <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    className="text-default-500 hover:text-foreground rounded-lg animate-pulse"
                                    aria-label="Notifications"
                                >
                                    <Bell className="h-4 w-4" />
                                </Button>
                            </BadgeAnchor>
                            <BadgeLabel>{unread > 99 ? "99+" : unread}</BadgeLabel>
                        </Badge>
                    ) : (
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            className="text-default-500 hover:text-foreground rounded-lg"
                            aria-label="Notifications"
                        >
                            <Bell className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent placement="bottom end" className="w-80 p-0 border border-default-100 bg-background/95 backdrop-blur-md shadow-xl rounded-xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-divider px-4 py-3 bg-default-50/50">
                    <span className="text-xs font-bold text-foreground">Inbox</span>
                    {unread > 0 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-[11px] font-bold text-primary h-7 px-2 flex items-center gap-1"
                            onClick={handleMarkAll}
                        >
                            <Check className="h-3 w-3" />
                            Mark all read
                        </Button>
                    )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="px-4 py-8 text-center text-xs text-default-400">
                            Loading…
                        </div>
                    ) : !items || items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-10 text-center">
                            <div className="h-10 w-10 rounded-full bg-default-100 flex items-center justify-center text-default-400">
                                <Inbox className="h-5 w-5" />
                            </div>
                            <div className="text-xs font-semibold text-default-500">
                                You're all caught up.
                            </div>
                        </div>
                    ) : (
                        items.map((item) => {
                            const content = (
                                <div
                                    className={cn(
                                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-default-50",
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
                                        <div className="text-xs font-bold text-foreground truncate">
                                            {item.title}
                                        </div>
                                        {item.body && (
                                            <div className="mt-0.5 text-[11px] text-default-500 line-clamp-2">
                                                {item.body}
                                            </div>
                                        )}
                                        <div className="mt-1.5 text-[10px] font-medium text-default-400">
                                            {formatRelative(item.createdAt)}
                                        </div>
                                    </div>
                                    {item.link && (
                                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-default-400" />
                                    )}
                                </div>
                            );

                            if (item.link) {
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.link}
                                        onClick={() => handleClickItem(item)}
                                        className="block border-b border-divider last:border-b-0"
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
                                    className="block w-full border-b border-divider last:border-b-0 cursor-pointer"
                                >
                                    {content}
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
