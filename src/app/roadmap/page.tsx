import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { discordSignInUrl } from "@/lib/auth-urls";
import { db } from "@/lib/db";
import { canManageRoadmap, getPermissionContext } from "@/lib/permissions";
import { RoadmapClient } from "./RoadmapClient";

export const metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(discordSignInUrl("/roadmap"));
  const permissions = await getPermissionContext(session.user.id);
  const releases = await db.release.findMany({
    include: { issues: { select: { issue: { select: { id: true, publicKey: true, title: true, status: true } } }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return <RoadmapClient canManage={canManageRoadmap(permissions)} milestones={releases.map((release) => ({
    id: release.id,
    name: release.name,
    description: release.description,
    status: release.status,
    targetDate: release.targetDate?.toISOString().slice(0, 10) ?? null,
    issues: release.issues.map((link) => link.issue),
  }))} today={new Date().toISOString().slice(0, 10)} />;
}
