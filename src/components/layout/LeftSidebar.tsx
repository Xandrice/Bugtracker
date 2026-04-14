"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Inbox,
    ListTodo,
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

export function LeftSidebar({ isLoggedIn }: { isLoggedIn: boolean }) {
    const pathname = usePathname();
    const groups = isLoggedIn
        ? navItems
        : [
            {
                title: "Issues",
                items: [{ name: "All Issues", href: "/issues", icon: ListTodo }],
            }
        ];

    return (
        <aside className="w-56 border-r border-border/80 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/72 h-[calc(100vh-3rem)] overflow-hidden hidden md:block shrink-0 transition-colors duration-200 flex flex-col">
            <div className="flex flex-col gap-4 py-4 px-3 min-h-0 overflow-hidden">
                {groups.map((group, i) => (
                    <div key={i} className="flex flex-col gap-1 gta-surface p-2">
                        <h4 className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase px-2 mb-1">
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
                                            "flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-xs uppercase tracking-[0.08em] font-medium transition-all group relative overflow-hidden border",
                                            isActive
                                                ? "bg-primary/20 text-foreground border-primary/40"
                                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border-border/40"
                                        )}
                                    >
                                        {isActive && (
                                            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
                                        )}
                                        <item.icon className={clsx("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                ))}

                {isLoggedIn && (
                    <div className="mt-auto">
                        <Link
                            href="/settings"
                            className={clsx(
                                "flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-xs uppercase tracking-[0.08em] font-medium transition-all group relative overflow-hidden gta-surface border",
                                pathname === "/settings"
                                    ? "bg-primary/20 text-foreground border-primary/40"
                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border-border/40"
                            )}
                        >
                            {pathname === "/settings" && (
                                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
                            )}
                            <Settings2 className={clsx("h-3.5 w-3.5", pathname === "/settings" ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                            Project Settings
                        </Link>
                    </div>
                )}
            </div>
        </aside>
    );
}
