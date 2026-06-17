import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { getStaffUsers } from "@/lib/staff";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { Avatar } from "@/components/ui/Avatar";
import { canManageReports, getPermissionContext } from "@/lib/permissions";
import { updatePlayerReportStatus } from "@/app/staff-actions";
import { Button } from "@/components/ui/Button";
import { discordSignInUrl } from "@/lib/auth-urls";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(discordSignInUrl("/reports"));

  const permissions = await getPermissionContext(session.user.id);
  const canManage = canManageReports(permissions);
  const staffUsers = canManage ? await getStaffUsers() : [];

  const report = await (db as any).playerReport.findUnique({
    where: { id },
    include: { reporter: true, assignee: true },
  });
  if (!report) notFound();

  let subjectAccount: { name: string | null; image: string | null } | null = null;
  if (report.subjectDiscordId) {
    const account = await db.account.findFirst({
      where: { provider: "discord", providerAccountId: report.subjectDiscordId },
      include: { user: true },
    });
    if (account?.user) {
      subjectAccount = { name: account.user.name, image: account.user.image };
    }
  }
  const subjectName = report.subjectName || subjectAccount?.name || report.accusedPlayer || null;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title={report.title} description={`Status: ${report.status}`} />
      <Card>
        <CardBody className="space-y-3">
          {(report.subjectDiscordId || subjectName) && (
            <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2 px-3 py-2">
              <Avatar name={subjectName} src={subjectAccount?.image} size="md" />
              <div className="leading-tight">
                <p className="text-sm font-medium text-foreground">
                  {subjectName || "Unknown member"}
                </p>
                {report.subjectDiscordId && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {report.subjectDiscordId}
                  </p>
                )}
              </div>
            </div>
          )}
          {report.description && <MarkdownContent content={report.description} />}
          <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {report.reporterName && <p>Source: {report.reporterName}</p>}
            <p>Category: {report.category}</p>
            <p>Logged by: {report.reporter?.name || "Staff"}</p>
          </div>
          {report.evidenceLinks && (
            <pre className="rounded-md border border-border bg-muted p-3 text-xs whitespace-pre-wrap">
              {report.evidenceLinks}
            </pre>
          )}
          {canManage && (
            <form action={updatePlayerReportStatus} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={report.id} />
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Status</label>
                <select
                  name="status"
                  defaultValue={report.status}
                  className="h-8 rounded-md border border-input bg-elevated px-2 text-xs"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_REVIEW">In review</option>
                  <option value="ACTION_TAKEN">Action taken</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Assignee</label>
                <select
                  name="assigneeId"
                  defaultValue={report.assigneeId || "none"}
                  className="h-8 rounded-md border border-input bg-elevated px-2 text-xs"
                >
                  <option value="none">Unassigned</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.id}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" variant="primary">
                Update
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </PageContainer>
  );
}
