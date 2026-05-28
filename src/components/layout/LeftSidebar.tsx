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
import { Button } from "@heroui/react";

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
        <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-divider bg-background/50 backdrop-blur-md h-full overflow-hidden">
            <div className="px-4 pt-4 pb-2">
                <Link
                    href="/issues/new"
                    className="w-full text-xs font-bold h-9 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 rounded-lg transition-all shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    New issue
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
                {groups.map((group) => (
                    <div key={group.title} className="space-y-1">
                        <h4 className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-default-400">
                            {group.title}
                        </h4>
                        {group.items.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 border-l-2",
                                        isActive
                                            ? "bg-primary/10 text-primary border-primary shadow-sm shadow-primary/5"
                                            : "text-default-500 hover:bg-default-100 hover:text-foreground border-transparent"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                                            isActive
                                                ? "text-primary"
                                                : "text-default-400 group-hover:text-foreground"
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
                <div className="border-t border-divider px-3 py-3">
                    <Link
                        href="/settings"
                        className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 border-l-2",
                            pathname === "/settings"
                                ? "bg-primary/10 text-primary border-primary shadow-sm shadow-primary/5"
                                : "text-default-500 hover:bg-default-100 hover:text-foreground border-transparent"
                        )}
                    >
                        <Settings2 className="h-4 w-4 shrink-0" />
                        Settings
                    </Link>
                </div>
            )}
        </aside>
    );
}

