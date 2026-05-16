"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Inbox,
    ListTodo,
    KanbanSquare,
    LayoutDashboard,
    FileText,
    Users,
    Settings2,
    Plus,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

const navItems = [
    {
        title: "Work",
        items: [
            { name: "My issues", href: "/issues/me", icon: Inbox },
            { name: "All issues", href: "/issues", icon: ListTodo },
        ],
    },
    {
        title: "Boards",
        items: [
            { name: "Main board", href: "/boards/main", icon: LayoutDashboard },
            { name: "Triage", href: "/boards/triage", icon: KanbanSquare },
        ],
    },
    {
        title: "Team",
        items: [
            { name: "Notes", href: "/notes", icon: FileText },
            { name: "Members", href: "/members", icon: Users },
        ],
    },
];

export function LeftSidebar({ isLoggedIn }: { isLoggedIn: boolean }) {
    const pathname = usePathname();
    const groups = isLoggedIn
        ? navItems
        : [
              {
                  title: "Work",
                  items: [{ name: "All issues", href: "/issues", icon: ListTodo }],
              },
          ];

    return (
        <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-border bg-surface/40 h-full overflow-hidden">
            <div className="px-3 pt-3 pb-2">
                <Link
                    href="/issues/new"
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    <Plus className="h-3.5 w-3.5" />
                    New issue
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
                {groups.map((group) => (
                    <div key={group.title} className="space-y-0.5">
                        <h4 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">
                            {group.title}
                        </h4>
                        {group.items.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                        isActive
                                            ? "bg-primary/12 text-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-3.5 w-3.5 shrink-0",
                                            isActive
                                                ? "text-primary"
                                                : "text-subtle-foreground group-hover:text-foreground"
                                        )}
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {isLoggedIn && (
                <div className="border-t border-border px-2 py-2">
                    <Link
                        href="/settings"
                        className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                            pathname === "/settings"
                                ? "bg-primary/12 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Settings2 className="h-3.5 w-3.5 shrink-0" />
                        Settings
                    </Link>
                </div>
            )}
        </aside>
    );
}
