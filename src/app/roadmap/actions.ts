"use server";

import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { canManageRoadmap, getPermissionContext } from "@/lib/permissions";
import { parseRoadmapDate, ROADMAP_STATUSES, type RoadmapIssue } from "@/lib/roadmap";
import { revalidatePath } from "next/cache";

async function roadmapManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const permissions = await getPermissionContext(session.user.id);
  return canManageRoadmap(permissions) ? session.user.id : null;
}

export async function searchRoadmapIssues(query: string): Promise<{ issues: RoadmapIssue[]; error?: string }> {
  if (!(await roadmapManager())) return { issues: [], error: "You do not have permission to manage the roadmap." };
  if (typeof query !== "string" || query.length > 200) return { issues: [], error: "Search must be 200 characters or fewer." };
  try {
    const issues = await db.issue.findMany({
      where: query.trim() ? { OR: [
        { title: { contains: query.trim(), mode: "insensitive" } },
        { publicKey: { contains: query.trim(), mode: "insensitive" } },
      ] } : {},
      select: { id: true, publicKey: true, title: true, status: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 20,
    });
    return { issues };
  } catch {
    return { issues: [], error: "Could not load issues. Try again." };
  }
}

export async function saveRoadmapMilestone(form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const authorId = await roadmapManager();
  if (!authorId) return { error: "You do not have permission to manage the roadmap." };
  const id = form.get("id");
  const name = form.get("name");
  const description = form.get("description");
  const status = form.get("status");
  const date = form.get("targetDate");
  if (typeof id !== "string" || id.length > 100) return { error: "Invalid milestone." };
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200) return { error: "Enter a milestone name of 1–200 characters." };
  if (typeof description !== "string" || description.length > 10000) return { error: "Description must be 10,000 characters or fewer." };
  if (typeof status !== "string" || !ROADMAP_STATUSES.includes(status as typeof ROADMAP_STATUSES[number])) return { error: "Choose a valid status." };
  if (typeof date !== "string" || (date && !parseRoadmapDate(date))) return { error: "Choose a valid target date." };
  const rawIssueIds = form.getAll("issueId");
  if (rawIssueIds.length > 100 || rawIssueIds.some((value) => typeof value !== "string" || !value || value.length > 100)) return { error: "Choose up to 100 valid issues." };
  const issueIds = [...new Set(rawIssueIds as string[])];
  try {
    await db.$transaction(async (tx) => {
      if (issueIds.length && await tx.issue.count({ where: { id: { in: issueIds } } }) !== issueIds.length) throw new Error("Missing issue");
      const data = { name: name.trim(), description: description.trim() || null, status, targetDate: date ? parseRoadmapDate(date) : null };
      if (id) {
        await tx.release.update({ where: { id }, data: {
          ...data, issues: { deleteMany: {}, create: issueIds.map((issueId) => ({ issueId })) },
        } });
      } else {
        await tx.release.create({ data: { ...data, authorId, issues: { create: issueIds.map((issueId) => ({ issueId })) } } });
      }
    });
  } catch {
    return { error: "Could not save this milestone. It or a linked issue may have been removed. Try again." };
  }
  revalidatePath("/roadmap");
  return { ok: true };
}

export async function deleteRoadmapMilestone(id: string): Promise<{ error?: string; ok?: boolean }> {
  if (!(await roadmapManager())) return { error: "You do not have permission to manage the roadmap." };
  if (typeof id !== "string" || !id || id.length > 100) return { error: "Invalid milestone." };
  try {
    await db.release.delete({ where: { id } });
  } catch {
    return { error: "Could not delete this milestone. Try again." };
  }
  revalidatePath("/roadmap");
  return { ok: true };
}
