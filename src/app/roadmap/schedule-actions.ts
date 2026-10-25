"use server";

import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { canEditIssues, canManageRoadmap, getPermissionContext } from "@/lib/permissions";
import { pgTable } from "@/lib/pg-schema";
import { parseRoadmapDate } from "@/lib/roadmap";
import { requireScheduleCategories, scheduleCategoryIds } from "@/lib/schedule-store";
import { revalidatePath } from "next/cache";

async function scheduleUser(kind: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const permissions = await getPermissionContext(session.user.id);
  return (kind === "ISSUE" ? canEditIssues(permissions) : canManageRoadmap(permissions)) ? session.user.id : null;
}

function refreshSchedule(id?: string) {
  revalidatePath("/roadmap");
  revalidatePath("/boards/main");
  revalidatePath("/issues");
  revalidatePath("/issues/me");
  revalidatePath("/issues/backlog");
  revalidatePath("/");
  if (id) revalidatePath(`/issues/${id}`);
}

export async function saveScheduleCategory(form: FormData): Promise<{ error?: string; ok?: boolean }> {
  if (!(await scheduleUser("RELEASE"))) return { error: "You do not have permission to manage categories." };
  const id = form.get("id"), name = form.get("name"), color = form.get("color");
  if (typeof id !== "string" || id.length > 100 || typeof name !== "string" || !name.trim() || name.trim().length > 60 || typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return { error: "Enter a category name (up to 60 characters) and a six-digit hex color." };
  try {
    const data = { name: name.trim(), color: color.toUpperCase() };
    if (id) await db.scheduleCategory.update({ where: { id }, data });
    else await db.scheduleCategory.create({ data });
  } catch { return { error: "Could not save category. Names must be unique; refresh and try again." }; }
  refreshSchedule();
  revalidatePath("/issues/[id]", "page");
  return { ok: true };
}

export async function deleteScheduleCategory(id: string): Promise<{ error?: string; ok?: boolean }> {
  if (!(await scheduleUser("RELEASE"))) return { error: "You do not have permission to manage categories." };
  if (typeof id !== "string" || !id || id.length > 100) return { error: "Invalid category." };
  try { await db.scheduleCategory.delete({ where: { id } }); }
  catch { return { error: "Could not delete category. Refresh and try again." }; }
  refreshSchedule();
  revalidatePath("/issues/[id]", "page");
  return { ok: true };
}

export async function saveTaskSchedule(form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const actorId = await scheduleUser("ISSUE");
  if (!actorId) return { error: "You do not have permission to schedule tasks." };
  const id = form.get("id"), start = form.get("startDate"), end = form.get("dueDate");
  const categoryIds = scheduleCategoryIds(form);
  if (typeof id !== "string" || !id || id.length > 100 || typeof start !== "string" || typeof end !== "string" || (start && !parseRoadmapDate(start)) || (end && !parseRoadmapDate(end)) || (start && (!end || start > end)) || !categoryIds) return { error: "Choose valid categories and dates. Start date requires a due date on or after it." };
  try {
    await db.$transaction(async tx => {
      await requireScheduleCategories(tx, categoryIds);
      await tx.$queryRaw`SELECT id FROM ${pgTable("Issue")} WHERE id = ${id} FOR UPDATE`;
      const previous = await tx.issue.findUniqueOrThrow({ where: { id }, select: { startDate: true, dueDate: true, categories: { select: { name: true } } } });
      const updated = await tx.issue.update({ where: { id }, data: { startDate: start ? parseRoadmapDate(start) : null, dueDate: end ? parseRoadmapDate(end) : null, categories: { set: categoryIds.map(id => ({ id })) } }, select: { categories: { select: { name: true } } } });
      const changes = [
        { field: "startDate", oldValue: previous.startDate?.toISOString() ?? null, newValue: start ? parseRoadmapDate(start)!.toISOString() : null },
        { field: "dueDate", oldValue: previous.dueDate?.toISOString() ?? null, newValue: end ? parseRoadmapDate(end)!.toISOString() : null },
        { field: "categories", oldValue: previous.categories.map(c => c.name).sort().join(", ") || null, newValue: updated.categories.map(c => c.name).sort().join(", ") || null },
      ];
      for (const change of changes.filter(change => change.oldValue !== change.newValue)) {
        await tx.issueActivity.create({ data: { issueId: id, actorId, action: "FIELD_CHANGE", ...change } });
      }
    });
  } catch { return { error: "Could not save this schedule. The task or a category may have been removed. Refresh and try again." }; }
  refreshSchedule(id);
  return { ok: true };
}

// Compare the original dates atomically so a stale drag cannot overwrite a newer schedule.
export async function moveScheduleItem(input: { kind: "ISSUE" | "RELEASE"; id: string; start: string; end: string; previousStart: string | null; previousEnd: string }): Promise<{ error?: string; ok?: boolean }> {
  if (!input || !["ISSUE", "RELEASE"].includes(input.kind)) return { error: "Invalid schedule item." };
  const actorId = await scheduleUser(input.kind);
  if (!actorId) return { error: "You do not have permission to move this item." };
  if (typeof input.id !== "string" || !input.id || input.id.length > 100 || !parseRoadmapDate(input.start) || !parseRoadmapDate(input.end) || input.start > input.end || !parseRoadmapDate(input.previousEnd) || (input.previousStart !== null && !parseRoadmapDate(input.previousStart))) return { error: "Choose a valid date range." };
  try {
    const count = await db.$transaction(async tx => {
      const dates = { startDate: parseRoadmapDate(input.start) };
      const previous = { id: input.id, startDate: input.previousStart ? parseRoadmapDate(input.previousStart) : null };
      const result = input.kind === "ISSUE"
        ? await tx.issue.updateMany({ where: { ...previous, dueDate: parseRoadmapDate(input.previousEnd) }, data: { ...dates, dueDate: parseRoadmapDate(input.end) } })
        : await tx.release.updateMany({ where: { ...previous, targetDate: parseRoadmapDate(input.previousEnd) }, data: { ...dates, targetDate: parseRoadmapDate(input.end) } });
      if (input.kind === "ISSUE" && result.count) await tx.issueActivity.create({ data: { issueId: input.id, actorId, action: "FIELD_CHANGE", field: "schedule", oldValue: `${input.previousStart || input.previousEnd} - ${input.previousEnd}`, newValue: `${input.start} - ${input.end}` } });
      return result.count;
    });
    if (!count) return { error: "This schedule changed or was removed. Refresh and try again." };
  } catch { return { error: "Could not move this item. Its original dates have been kept." }; }
  refreshSchedule(input.kind === "ISSUE" ? input.id : undefined);
  return { ok: true };
}
