import Link from "next/link";
import { Shield, Settings, LogOut } from "lucide-react";
import { auth } from "@/../auth";
import { SignInButton } from "@/components/auth/SignInButton";
import { db } from "@/lib/db";
import { ThemeToggle } from "./ThemeToggle";
import { SITE_NAME } from "@/lib/site";
import { NotificationBell } from "./NotificationBell";
import { SearchTriggerButton } from "./SearchTriggerButton";

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
        <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface/85 chrome-blur px-3 lg:px-4">
            <div className="flex items-center gap-3 min-w-0">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-90"
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Shield className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-semibold hidden sm:block whitespace-nowrap">
                        {SITE_NAME}
                    </span>
                    <span className="hidden md:block text-[11px] text-muted-foreground border-l border-border pl-2 ml-1">
                        Staff Panel
                    </span>
                </Link>
            </div>

            <div className="hidden flex-1 items-center justify-center px-4 max-w-xl md:flex">
                <SearchTriggerButton />
            </div>

            <div className="flex items-center gap-1">
                <ThemeToggle />
                {session?.user?.id && <NotificationBell unread={unread} />}
                <Link
                    href="/settings"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <Settings className="h-3.5 w-3.5" />
                </Link>

                {session?.user ? (
                    <details className="relative">
                        <summary className="list-none flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-1 hover:bg-muted transition-colors [&::-webkit-details-marker]:hidden">
                            {session.user.image ? (
                                <img
                                    src={session.user.image}
                                    alt="User profile"
                                    className="h-6 w-6 rounded-full border border-border object-cover"
                                />
                            ) : (
                                <div className="h-6 w-6 rounded-full border border-border bg-primary/10 text-primary flex items-center justify-center font-semibold text-[10px]">
                                    {session.user.name?.charAt(0).toUpperCase() || "U"}
                                </div>
                            )}
                        </summary>
                        <div className="absolute right-0 mt-1.5 w-48 rounded-md border border-border bg-elevated p-1 shadow-pop">
                            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1 truncate">
                                {session.user.name || "Signed in"}
                            </div>
                            <Link
                                href="/settings"
                                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                                Settings
                            </Link>
                            <Link
                                href="/api/auth/signout?callbackUrl=/"
                                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sign out
                            </Link>
                        </div>
                    </details>
                ) : (
                    <SignInButton callbackUrl="/issues" />
                )}
            </div>
        </header>
    );
}
