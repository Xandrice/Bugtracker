import { Megaphone } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { createAnnouncement } from "@/app/staff-actions";
import { canManageAnnouncements, getPermissionContext } from "@/lib/permissions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function NewAnnouncementPage() {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  if (!canManageAnnouncements(permissions)) redirect("/announcements");

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="New announcement"
        icon={<Megaphone className="h-4 w-4" />}
      />
      <Card>
        <CardBody>
          <form action={createAnnouncement} className="space-y-4">
            <Input name="title" required placeholder="Title" />
            <textarea
              name="body"
              required
              minLength={4}
              placeholder="Markdown body…"
              className="min-h-[160px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="pinned" />
              Pin to dashboard
            </label>
            <Input name="audienceRole" placeholder="Audience role (optional)" />
            <Input name="expiresAt" type="date" />
            <Button type="submit" variant="primary" size="sm">
              Publish
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
