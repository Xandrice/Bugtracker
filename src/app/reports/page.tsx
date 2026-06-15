import Link from "next/link";
import { Plus, Search, Shield } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

type SubjectInfo = { name: string | null; image: string | null };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <PageContainer>
        <PageHeader title="Mod log" icon={<Shield className="h-4 w-4" />} />
        <p className="text-sm text-muted-foreground">Sign in to view the mod log.</p>
      </PageContainer>
    );
  }

  const q = ((await searchParams).q || "").trim();

  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { subjectName: { contains: q, mode: "insensitive" as const } },
          { accusedPlayer: { contains: q, mode: "insensitive" as const } },
          { reporterName: { contains: q, mode: "insensitive" as const } },
          { evidenceLinks: { contains: q, mode: "insensitive" as const } },
          { category: { contains: q, mode: "insensitive" as const } },
          { status: { contains: q, mode: "insensitive" as const } },
          { subjectDiscordId: { contains: q } },
        ],
      }
    : undefined;

  const reports = await (db as any).playerReport.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { reporter: true, assignee: true },
  });

  // Resolve subject Discord IDs to linked accounts so we can show avatars/names.
  const discordIds: string[] = Array.from(
    new Set(
      (reports as Array<{ subjectDiscordId: string | null }>)
        .map((r) => r.subjectDiscordId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  const subjectsById = new Map<string, SubjectInfo>();
  if (discordIds.length > 0) {
    const accounts = await db.account.findMany({
      where: { provider: "discord", providerAccountId: { in: discordIds } },
      include: { user: true },
    });
    for (const account of accounts) {
      if (!account.user) continue;
      subjectsById.set(account.providerAccountId, {
        name: account.user.name,
        image: account.user.image,
      });
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mod log"
        description="Track why a member talked to staff or had an interaction worth noting."
        icon={<Shield className="h-4 w-4" />}
        actions={
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New entry
          </Link>
        }
      />

      <form action="/reports" method="get" className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by Discord ID, name, summary, or details"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" type="submit">
          Search
        </Button>
        {q && (
          <Link
            href="/reports"
            className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
            <tr>
              <th className="px-4 py-2">Summary</th>
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Handled by</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report: any) => {
              const linked = report.subjectDiscordId
                ? subjectsById.get(report.subjectDiscordId)
                : undefined;
              const displayName =
                report.subjectName || linked?.name || report.accusedPlayer || null;
              return (
                <tr key={report.id} className="border-b border-border hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/reports/${report.id}`} className="font-medium hover:text-primary">
                      {report.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {report.subjectDiscordId || displayName ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={displayName} src={linked?.image} size="xs" />
                        <div className="leading-tight">
                          {displayName && (
                            <p className="text-xs font-medium text-foreground">{displayName}</p>
                          )}
                          {report.subjectDiscordId && (
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {report.subjectDiscordId}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{report.category}</td>
                  <td className="px-4 py-3">
                    <Badge tone={report.status === "CLOSED" ? "success" : "warning"}>
                      {report.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {report.assignee?.name || "Unassigned"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {reports.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {q ? `No mod-log entries match "${q}".` : "No mod-log entries yet."}
          </p>
        )}
      </div>
    </PageContainer>
  );
}
