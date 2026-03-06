"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Inbox,
    ListTodo,
    Trello,
    KanbanSquare,
    FileText,
    Users,
    Settings2
} from "lucide-react";
import clsx from "clsx";

const navItems = [
    {
        title: "Issues",
        items: [
            { name: "My Issues", href: "/issues/me", icon: Inbox },
            { name: "All Issues", href: "/issues", icon: ListTodo },
        ]
    },
    {
        title: "Boards",
        items: [
            { name: "Bug Triage", href: "/boards/triage", icon: KanbanSquare },
            { name: "Kanban Board", href: "/boards/main", icon: Trello },
        ]
    },
    {
        title: "Team & Docs",
        items: [
            { name: "Team Notes", href: "/notes", icon: FileText },
            { name: "Members", href: "/members", icon: Users },
        ]
    }
];

export function LeftSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[calc(100vh-3.5rem)] overflow-y-auto hidden md:block shrink-0 transition-colors duration-200">
            <div className="flex flex-col gap-6 py-6 px-4">
                {navItems.map((group, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2 mb-1">
                            {group.title}
                        </h4>
                        <nav className="flex flex-col gap-1">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={clsx(
                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all group relative overflow-hidden",
                                            isActive
                                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        {isActive && (
                                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                                        )}
                                        <item.icon className={clsx("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                ))}

                <div className="mt-auto">
                    <Link
                        href="/settings"
                        className={clsx(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all group relative overflow-hidden",
                            pathname === "/settings"
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {pathname === "/settings" && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                        )}
                        <Settings2 className={clsx("h-4 w-4", pathname === "/settings" ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                        Project Settings
                    </Link>
                </div>
            </div>
        </aside>
    );
}
