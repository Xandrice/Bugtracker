import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { discordSignInUrl } from "@/lib/auth-urls";
import { db } from "@/lib/db";
import { canEditIssues, canManageRoadmap, getPermissionContext } from "@/lib/permissions";
import { RoadmapClient } from "./RoadmapClient";

export const metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(discordSignInUrl("/roadmap"));
  const permissions = await getPermissionContext(session.user.id);
  const releases = await db.release.findMany({
    include: { categories: { orderBy: { name: "asc" } }, issues: { select: { issue: { select: { id: true, publicKey: true, title: true, status: true } } }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  const [categories, tasks] = await Promise.all([
    db.scheduleCategory.findMany({ orderBy: { name: "asc" } }),
    db.issue.findMany({ where: { startDate: { not: null }, dueDate: { not: null } },
      select: { id: true, publicKey: true, title: true, status: true, startDate: true, dueDate: true, categories: { orderBy: { name: "asc" } } },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    }),
  ]);
  return <RoadmapClient categories={categories} canEditTasks={canEditIssues(permissions)} tasks={tasks.map(task => ({ ...task, startDate: task.startDate!.toISOString().slice(0, 10), dueDate: task.dueDate!.toISOString().slice(0, 10) }))} canManage={canManageRoadmap(permissions)} milestones={releases.map((release) => ({
    id: release.id,
    name: release.name,
    description: release.description,
    status: release.status,
    categories: release.categories,
    startDate: release.startDate?.toISOString().slice(0, 10) ?? null,
    targetDate: release.targetDate?.toISOString().slice(0, 10) ?? null,
    issues: release.issues.map((link) => link.issue),
  }))} today={new Date().toISOString().slice(0, 10)} />;
}
