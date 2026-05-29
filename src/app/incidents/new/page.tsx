import { AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { createIncident } from "@/app/staff-actions";
import { canManageIncidents, getPermissionContext } from "@/lib/permissions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function NewIncidentPage() {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  if (!canManageIncidents(permissions)) redirect("/incidents");

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title="New incident" icon={<AlertTriangle className="h-4 w-4" />} />
      <Card>
        <CardBody>
          <form action={createIncident} className="space-y-4">
            <Input name="title" required placeholder="Incident title" />
            <textarea
              name="description"
              placeholder="What is happening?"
              className="min-h-[120px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
            />
            <select
              name="severity"
              defaultValue="MAJOR"
              className="h-8 w-full rounded-md border border-input bg-elevated px-2 text-xs"
            >
              <option value="MINOR">Minor</option>
              <option value="MAJOR">Major</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <Button type="submit" variant="primary" size="sm">
              Create incident
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
