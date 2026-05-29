import { Rocket } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { createRelease } from "@/app/staff-actions";
import { canManageReleases, getPermissionContext } from "@/lib/permissions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function NewReleasePage() {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  if (!canManageReleases(permissions)) redirect("/releases");

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title="New release" icon={<Rocket className="h-4 w-4" />} />
      <Card>
        <CardBody>
          <form action={createRelease} className="space-y-4">
            <Input name="name" required placeholder="Release name (e.g. v2.4)" />
            <textarea
              name="description"
              placeholder="Release notes / checklist…"
              className="min-h-[120px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
            />
            <Input name="targetDate" type="date" />
            <Button type="submit" variant="primary" size="sm">
              Create release
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
