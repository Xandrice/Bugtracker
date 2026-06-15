"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Inbox,
  ListTodo,
  KanbanSquare,
  LayoutDashboard,
  FileText,
  Users,
  Settings2,
  Plus,
  AlertTriangle,
  Shield,
  Logs,
  Car,
  Coins,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

type StaffToolAccess = {
  players: boolean;
  vehicles: boolean;
  economy: boolean;
};

function navItems(canViewLogs: boolean, staffToolAccess: StaffToolAccess) {
  const staffToolItems = [
    ...(staffToolAccess.players ? [{ name: "Players", href: "/staff-tools/players", icon: Users }] : []),
    ...(staffToolAccess.vehicles ? [{ name: "Vehicles", href: "/staff-tools/vehicles", icon: Car }] : []),
    ...(staffToolAccess.economy ? [{ name: "Economy", href: "/staff-tools/economy", icon: Coins }] : []),
  ];

  return [
  {
    title: "Dashboard",
    items: [{ name: "Home", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Work",
    items: [
      { name: "My issues", href: "/issues/me", icon: Inbox },
      { name: "All issues", href: "/issues", icon: ListTodo },
      { name: "Backlog", href: "/issues/backlog", icon: Archive },
      { name: "Main board", href: "/boards/main", icon: KanbanSquare },
      { name: "Triage", href: "/boards/triage", icon: KanbanSquare },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Incidents", href: "/incidents", icon: AlertTriangle },
      { name: "Mod log", href: "/reports", icon: Shield },
      ...(canViewLogs ? [{ name: "Logs", href: "/logs", icon: Logs }] : []),
    ],
  },
  ...(staffToolItems.length > 0
    ? [
        {
          title: "Staff tools",
          items: staffToolItems,
        },
      ]
    : []),
  {
    title: "Docs",
    items: [{ name: "Playbooks", href: "/notes", icon: FileText }],
  },
  {
    title: "People",
    items: [{ name: "Members", href: "/members", icon: Users }],
  },
];
}

export function LeftSidebar({
  isLoggedIn,
  canViewLogs = false,
  staffToolAccess = { players: false, vehicles: false, economy: false },
}: {
  isLoggedIn: boolean;
  canViewLogs?: boolean;
  staffToolAccess?: StaffToolAccess;
}) {
  const pathname = usePathname();
  const groups = isLoggedIn
    ? navItems(canViewLogs, staffToolAccess)
    : [
        {
          title: "Work",
          items: [
            { name: "Dashboard", href: "/", icon: LayoutDashboard },
            { name: "All issues", href: "/issues", icon: ListTodo },
            { name: "Backlog", href: "/issues/backlog", icon: Archive },
          ],
        },
      ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active
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
