import Link from "next/link";
import { Bug, Search, UserCircle, Settings } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { ThemeToggle } from "./ThemeToggle";
import { SITE_NAME } from "@/lib/site";
import { NotificationBell } from "./NotificationBell";
import { UserDropdown } from "./UserDropdown";

async function getUnreadCount(userId: string | undefined) {
    if (!userId) return 0;
    try {
        return await (db as any).notification.count({
            where: { userId, readAt: null },
        });
    } catch {
        return 0;
    }
}

export async function TopNavbar() {
    const session = await auth();
    const unread = await getUnreadCount(session?.user?.id);

    return (
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-divider bg-background/70 backdrop-blur-md px-4 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
                <Link
                    href="/"
                    className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90"
                >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-blue-400 text-primary-foreground shadow-md shadow-primary/20">
                        <Bug className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-bold tracking-tight hidden sm:block whitespace-nowrap bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                        {SITE_NAME}
                    </span>
                    <span className="hidden md:block text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20 ml-1">
                        Tracker
                    </span>
                </Link>
            </div>

            <div className="hidden flex-1 items-center justify-center px-6 max-w-xl md:flex">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-default-400 pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search issues, notes, members…"
                        className="h-8.5 w-full rounded-lg border border-default-200 bg-default-100/40 pl-9 pr-12 text-xs text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all hover:bg-default-100/60"
                    />
                    <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center rounded border border-default-200 bg-background px-1.5 text-[9px] font-semibold text-default-400 sm:inline-flex">
                        ⌘K
                    </kbd>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <ThemeToggle />
                {session?.user?.id && <NotificationBell unread={unread} />}
                <Link
                    href="/settings"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-default-500 transition-colors hover:bg-default-100 hover:text-foreground"
                >
                    <Settings className="h-4 w-4" />
                </Link>

                <div className="h-6 w-px bg-divider mx-1 hidden sm:block" />

                {session?.user ? (
                    <UserDropdown user={session.user} />
                ) : (
                    <Link
                        href="/api/auth/signin?callbackUrl=/issues"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-default-200 bg-background px-3 h-8 text-xs font-semibold text-foreground hover:bg-default-100 transition-colors"
                    >
                        <UserCircle className="h-3.5 w-3.5" />
                        Sign in
                    </Link>
                )}
            </div>
        </header>
    );
}
