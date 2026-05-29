"use server";

import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageAnnouncements,
  canManageIncidents,
  canManageReleases,
  canManageReports,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { formatIssueRef } from "@/lib/issue-ids";

function redirectToSignIn(): never {
  redirect("/api/auth/signin");
}

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const permissions = await getPermissionContext(userId);
  return { session, permissions, userId };
}

// ---------- Global search ----------

export async function globalSearch(query: string) {
  const session = await auth();
  if (!session?.user?.id) return { issues: [], notes: [], members: [] };

  const q = query.trim();
  if (!q || q.length < 2) return { issues: [], notes: [], members: [] };

  const [issues, notes, members] = await Promise.all([
    db.issue.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { publicKey: { contains: q.toLowerCase() } },
        ],
      },
      take: 8,
      select: { id: true, publicKey: true, title: true, status: true, type: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.note.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 6,
      select: { id: true, title: true, content: true, isThread: true, issueId: true },
      orderBy: { updatedAt: "desc" },
    }),
    (db as any).projectMember.findMany({
      where: { discordId: { contains: q } },
      take: 5,
    }),
  ]);

  return {
    issues: issues.map((i) => ({
      id: i.id,
      ref: formatIssueRef(i.publicKey, i.id),
      title: i.title,
      status: i.status,
      type: i.type,
      href: `/issues/${formatIssueRef(i.publicKey, i.id)}`,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title || n.content.slice(0, 60),
      href: n.issueId
        ? `/issues/${n.issueId}`
        : n.isThread
          ? `/notes/${n.id}`
          : "/notes",
    })),
    members: members.map((m: any) => ({
      id: m.id,
      discordId: m.discordId,
      role: m.role,
      href: "/members",
    })),
  };
}

// ---------- Saved views ----------

export type SavedViewFilters = {
  status?: string;
  type?: string;
  assignee?: string;
  search?: string;
};

export async function getMySavedViews() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return (db as any).savedView.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveSavedView(name: string, filters: SavedViewFilters) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };

  await (db as any).savedView.create({
    data: {
      userId: session.user.id,
      name: trimmed,
      filters: JSON.stringify(filters),
    },
  });

  revalidatePath("/issues");
  return { ok: true };
}

export async function deleteSavedView(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await (db as any).savedView.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/issues");
  return { ok: true };
}

// ---------- Announcements ----------

export async function createAnnouncement(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageAnnouncements(actor.permissions));
  if (denied) throw new Error(denied.error);

  const title = (formData.get("title") as string | null)?.trim();
  const body = (formData.get("body") as string | null)?.trim();
  const pinned = formData.get("pinned") === "on";
  const audienceRole = (formData.get("audienceRole") as string | null)?.trim() || null;
  const expiresAtRaw = formData.get("expiresAt") as string | null;

  if (!title || !body) throw new Error("Title and body required");

  await (db as any).announcement.create({
    data: {
      title,
      body,
      pinned,
      audienceRole,
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      authorId: actor.userId,
    },
  });

  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}

export async function deleteAnnouncement(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageAnnouncements(actor.permissions));
  if (denied) throw new Error(denied.error);

  const id = formData.get("id") as string | null;
  if (!id) throw new Error("Missing id");

  await (db as any).announcement.delete({ where: { id } });
  revalidatePath("/announcements");
  revalidatePath("/");
}

// ---------- Incidents ----------

const INCIDENT_STATUSES = ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"] as const;

export async function createIncident(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageIncidents(actor.permissions));
  if (denied) throw new Error(denied.error);

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const severity = (formData.get("severity") as string | null) || "MINOR";
  if (!title) throw new Error("Title required");

  const incident = await (db as any).incident.create({
    data: {
      title,
      description: description || null,
      severity,
      reporterId: actor.userId,
    },
  });

  revalidatePath("/incidents");
  revalidatePath("/");
  redirect(`/incidents/${incident.id}`);
}

export async function updateIncidentStatus(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageIncidents(actor.permissions));
  if (denied) throw new Error(denied.error);

  const id = formData.get("id") as string | null;
  const status = formData.get("status") as string | null;
  if (!id || !status || !INCIDENT_STATUSES.includes(status as any)) {
    throw new Error("Invalid status");
  }

  await (db as any).incident.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
    },
  });

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${id}`);
  revalidatePath("/");
}

// ---------- Releases ----------

export async function createRelease(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageReleases(actor.permissions));
  if (denied) throw new Error(denied.error);

  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const targetDateRaw = formData.get("targetDate") as string | null;
  if (!name) throw new Error("Name required");

  const release = await (db as any).release.create({
    data: {
      name,
      description: description || null,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      authorId: actor.userId,
    },
  });

  revalidatePath("/releases");
  redirect(`/releases/${release.id}`);
}

export async function linkIssueToRelease(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageReleases(actor.permissions));
  if (denied) throw new Error(denied.error);

  const releaseId = formData.get("releaseId") as string | null;
  const issueRefRaw = (formData.get("issueRef") as string | null)?.trim();
  if (!releaseId || !issueRefRaw) throw new Error("Missing fields");

  const cleaned = issueRefRaw.replace(/^#/, "").toLowerCase();
  let issue = await db.issue.findUnique({
    where: { publicKey: cleaned },
    select: { id: true },
  });
  if (!issue) {
    issue = await db.issue.findUnique({
      where: { id: issueRefRaw },
      select: { id: true },
    });
  }
  if (!issue) throw new Error("Issue not found");

  await (db as any).releaseIssue.upsert({
    where: { releaseId_issueId: { releaseId, issueId: issue.id } },
    create: { releaseId, issueId: issue.id },
    update: {},
  });

  revalidatePath(`/releases/${releaseId}`);
}

// ---------- Player reports ----------

export async function createPlayerReport(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const reporterName = (formData.get("reporterName") as string | null)?.trim();
  const accusedPlayer = (formData.get("accusedPlayer") as string | null)?.trim();
  const category = (formData.get("category") as string | null) || "OTHER";
  const evidenceLinks = (formData.get("evidenceLinks") as string | null)?.trim();

  if (!title) throw new Error("Title required");

  const report = await (db as any).playerReport.create({
    data: {
      title,
      description: description || null,
      reporterName: reporterName || null,
      accusedPlayer: accusedPlayer || null,
      category,
      evidenceLinks: evidenceLinks || null,
      reporterId: actor.userId,
    },
  });

  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

export async function updatePlayerReportStatus(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageReports(actor.permissions));
  if (denied) throw new Error(denied.error);

  const id = formData.get("id") as string | null;
  const status = formData.get("status") as string | null;
  const assigneeId = formData.get("assigneeId") as string | null;
  if (!id || !status) throw new Error("Missing fields");

  await (db as any).playerReport.update({
    where: { id },
    data: {
      status,
      assigneeId: assigneeId && assigneeId !== "none" ? assigneeId : null,
    },
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
}

export async function getMyPermissions() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getPermissionContext(session.user.id);
}
