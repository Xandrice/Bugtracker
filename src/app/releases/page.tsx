import Link from "next/link";
import { Plus, Rocket } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { canManageReleases, getPermissionContext } from "@/lib/permissions";

export default async function ReleasesPage() {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  const canManage = canManageReleases(permissions);

  const releases = await (db as any).release.findMany({
    orderBy: { updatedAt: "desc" },
    include: { author: true, _count: { select: { issues: true } } },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Releases"
        description="Plan milestones and track linked issues."
        icon={<Rocket className="h-4 w-4" />}
        actions={
          canManage ? (
            <Link
              href="/releases/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New release
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {releases.map((release: any) => (
          <Link
            key={release.id}
            href={`/releases/${release.id}`}
            className="block rounded-md border border-border bg-surface p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{release.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {release.status} · {release._count.issues} linked issues
                </p>
              </div>
              {release.targetDate && (
                <span className="text-xs text-muted-foreground">
                  Target{" "}
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                    release.targetDate
                  )}
                </span>
              )}
            </div>
          </Link>
        ))}
        {releases.length === 0 && (
          <p className="text-sm text-muted-foreground">No releases yet.</p>
        )}
      </div>
    </PageContainer>
  );
}
