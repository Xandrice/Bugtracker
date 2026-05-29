import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { canManageIncidents, getPermissionContext } from "@/lib/permissions";
import { updateIncidentStatus } from "@/app/staff-actions";
import { Button } from "@/components/ui/Button";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  const canManage = canManageIncidents(permissions);

  const incident = await (db as any).incident.findUnique({
    where: { id },
    include: { reporter: true, assignee: true, linkedIssues: { include: { issue: true } } },
  });
  if (!incident) notFound();

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title={incident.title} description={`Status: ${incident.status}`} />
      <Card>
        <CardBody className="space-y-3">
          {incident.description && (
            <MarkdownContent content={incident.description} />
          )}
          <p className="text-xs text-muted-foreground">
            Reported by {incident.reporter?.name || "Staff"} · Severity {incident.severity}
          </p>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"].map((status) => (
                <form key={status} action={updateIncidentStatus}>
                  <input type="hidden" name="id" value={incident.id} />
                  <input type="hidden" name="status" value={status} />
                  <Button
                    type="submit"
                    variant={incident.status === status ? "primary" : "outline"}
                    size="xs"
                  >
                    {status}
                  </Button>
                </form>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </PageContainer>
  );
}
