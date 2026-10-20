"use server";
import { db } from "@/lib/db";
export async function loadIssueActivity(issueId: string, cursor?: string) {
  const activities = await db.issueActivity.findMany({ where: { issueId }, include: { actor: { select: { name: true, image: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const more = activities.length > 50;
  return { activities: activities.slice(0, 50).map(activity => ({ ...activity, createdAt: activity.createdAt.toISOString() })), more };
}
