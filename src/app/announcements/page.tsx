import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { canManageAnnouncements, getPermissionContext } from "@/lib/permissions";
import { deleteAnnouncement } from "@/app/staff-actions";
import { Button } from "@/components/ui/Button";

export default async function AnnouncementsPage() {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  const canManage = canManageAnnouncements(permissions);

  const announcements = await (db as any).announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: true },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        description="Staff-wide updates and pinned notices."
        icon={<Megaphone className="h-4 w-4" />}
        actions={
          canManage ? (
            <Link
              href="/announcements/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New announcement
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          announcements.map((item: any) => (
            <Card key={item.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {item.author?.name || "Staff"} ·{" "}
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                        item.createdAt
                      )}
                      {item.pinned && " · Pinned"}
                    </p>
                  </div>
                  {canManage && (
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="danger" size="xs">
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
                <MarkdownContent content={item.body} />
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
