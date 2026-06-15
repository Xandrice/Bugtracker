import Link from "next/link";
import {
  Archive,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Inbox,
  KanbanSquare,
  ListTodo,
  UserCircle2,
} from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { HOME_HERO_SUBTITLE } from "@/lib/site";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatIssueRef } from "@/lib/issue-ids";
import { StatusBadge } from "@/components/views/DataGrid";
import { normalizeStatus } from "@/lib/issue-tokens";
import { Avatar } from "@/components/ui/Avatar";

function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/8"
      : tone === "danger"
        ? "border-danger/30 bg-danger/8"
        : "border-border bg-surface";

  return (
    <Link
      href={href}
      className={`block rounded-md border p-4 transition-colors hover:border-border-strong ${toneClass}`}
    >
      <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [
    activeCount,
    backlogCount,
    urgentCount,
    unassignedCount,
    myAssignedCount,
    recentIssues,
    recentComments,
    activeIncidents,
  ] = await Promise.all([
    db.issue.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "REVIEW"] } },
    }),
    db.issue.count({ where: { status: "BACKLOG" } }),
    db.issue.count({
      where: { priority: "URGENT", status: { not: "DONE" } },
    }),
    db.issue.count({
      where: { assigneeId: null, status: "OPEN" },
    }),
    userId
      ? db.issue.count({
          where: { assigneeId: userId, status: { not: "DONE" } },
        })
      : Promise.resolve(0),
    db.issue.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { assignee: true },
    }),
    db.note.findMany({
      where: { issueId: { not: null } },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        author: true,
        issue: { select: { id: true, publicKey: true, title: true } },
      },
    }),
    (db as any).incident.findMany({
      where: { status: { not: "RESOLVED" } },
      take: 3,
      orderBy: { updatedAt: "desc" },
      include: { assignee: true },
    }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={HOME_HERO_SUBTITLE}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/boards/triage"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 h-8 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              Triage
            </Link>
            <Link
              href="/issues"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ListTodo className="h-3.5 w-3.5" />
              All issues
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Active work items" value={activeCount} href="/boards/main" />
        <StatCard
          label="Backlog"
          value={backlogCount}
          href="/issues/backlog"
        />
        <StatCard
          label="Urgent (not done)"
          value={urgentCount}
          href="/issues?priority=URGENT"
          tone="danger"
        />
        <StatCard
          label="Unassigned"
          value={unassignedCount}
          href="/boards/triage"
          tone="warning"
        />
        <StatCard
          label="Assigned to you"
          value={myAssignedCount}
          href="/issues/me"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent issues</CardTitle>
            <Link
              href="/issues"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardBody className="divide-y divide-border p-0">
            {recentIssues.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No issues yet.</p>
            ) : (
              recentIssues.map((issue) => {
                const issueRef = formatIssueRef(issue.publicKey, issue.id);
                return (
                  <Link
                    key={issue.id}
                    href={`/issues/${issueRef}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {issueRef}
                        </span>
                        <StatusBadge status={normalizeStatus(issue.status)} />
                      </div>
                      <p className="truncate text-sm font-medium text-foreground">
                        {issue.title}
                      </p>
                    </div>
                    {issue.assignee ? (
                      <Avatar
                        src={issue.assignee.image}
                        name={issue.assignee.name}
                        size="xs"
                      />
                    ) : (
                      <UserCircle2 className="h-4 w-4 text-subtle-foreground" />
                    )}
                  </Link>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent comments</CardTitle>
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardBody className="divide-y divide-border p-0">
            {recentComments.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              recentComments.map((comment: any) => {
                const issueRef = comment.issue
                  ? formatIssueRef(comment.issue.publicKey, comment.issue.id)
                  : null;
                return (
                  <Link
                    key={comment.id}
                    href={issueRef ? `/issues/${issueRef}` : "/issues"}
                    className="block px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Avatar
                        src={comment.author?.image}
                        name={comment.author?.name}
                        size="xs"
                      />
                      <span className="font-medium text-foreground">
                        {comment.author?.name || "Someone"}
                      </span>
                      <span>on</span>
                      <span className="font-mono">{issueRef}</span>
                      <Clock className="ml-auto h-3 w-3" />
                      <span>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                        }).format(comment.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {comment.content}
                    </p>
                  </Link>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      {activeIncidents.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Active incidents
            </CardTitle>
            <Link
              href="/incidents"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardBody className="divide-y divide-border p-0">
            {activeIncidents.map((incident: any) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {incident.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {incident.status.replace(/_/g, " ")} · {incident.severity}
                  </p>
                </div>
                {incident.assignee && (
                  <Avatar
                    src={incident.assignee.image}
                    name={incident.assignee.name}
                    size="xs"
                  />
                )}
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Link
          href="/boards/triage"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-muted/40"
        >
          <KanbanSquare className="h-5 w-5 text-warning" />
          <div>
            <div className="text-sm font-medium text-foreground">Triage queue</div>
            <div className="text-xs text-muted-foreground">
              {unassignedCount} unassigned open items
            </div>
          </div>
        </Link>
        <Link
          href="/issues/backlog"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-muted/40"
        >
          <Archive className="h-5 w-5 text-subtle-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">Backlog</div>
            <div className="text-xs text-muted-foreground">
              {backlogCount} parked work items
            </div>
          </div>
        </Link>
        <Link
          href="/issues/me"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-muted/40"
        >
          <Inbox className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-medium text-foreground">My workload</div>
            <div className="text-xs text-muted-foreground">
              {myAssignedCount} items assigned to you
            </div>
          </div>
        </Link>
        <Link
          href="/reports"
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-muted/40"
        >
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <div className="text-sm font-medium text-foreground">Mod log</div>
            <div className="text-xs text-muted-foreground">Member interaction history</div>
          </div>
        </Link>
      </div>
    </PageContainer>
  );
}
