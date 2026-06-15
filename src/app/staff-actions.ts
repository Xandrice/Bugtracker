"use server";

import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageAnnouncements,
  canManageIncidents,
  canManageReports,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { formatIssueRef } from "@/lib/issue-ids";
import { getAppBaseUrl, sendDiscordChannelMessage } from "@/lib/discord";
import { getStaffUsers } from "@/lib/staff";

const MODLOG_CHANNEL_KEY = "discord.modlog.channel";

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
  if (!session?.user?.id) return { issues: [], notes: [], members: [], reports: [] };

  const q = query.trim();
  if (!q || q.length < 2) return { issues: [], notes: [], members: [], reports: [] };

  const [issues, notes, members, reports] = await Promise.all([
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
    (db as any).playerReport.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { subjectName: { contains: q, mode: "insensitive" } },
          { accusedPlayer: { contains: q, mode: "insensitive" } },
          { reporterName: { contains: q, mode: "insensitive" } },
          { subjectDiscordId: { contains: q } },
        ],
      },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        subjectName: true,
        subjectDiscordId: true,
      },
      orderBy: { updatedAt: "desc" },
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
    reports: reports.map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      category: r.category,
      subject: r.subjectName || r.subjectDiscordId || null,
      href: `/reports/${r.id}`,
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

// ---------- Player reports ----------

export async function createPlayerReport(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const reporterName = (formData.get("reporterName") as string | null)?.trim();
  const accusedPlayer = (formData.get("accusedPlayer") as string | null)?.trim();
  const subjectDiscordId = (formData.get("subjectDiscordId") as string | null)?.trim();
  const subjectName = (formData.get("subjectName") as string | null)?.trim();
  const category = (formData.get("category") as string | null) || "OTHER";
  const evidenceLinks = (formData.get("evidenceLinks") as string | null)?.trim();

  if (!title) throw new Error("Title required");

  const report = await (db as any).playerReport.create({
    data: {
      title,
      description: description || null,
      reporterName: reporterName || null,
      accusedPlayer: accusedPlayer || null,
      subjectDiscordId: subjectDiscordId || null,
      subjectName: subjectName || null,
      category,
      evidenceLinks: evidenceLinks || null,
      reporterId: actor.userId,
    },
  });

  await postModLogToDiscord({
    reportId: report.id,
    title,
    description: description || null,
    category,
    subjectDiscordId: subjectDiscordId || null,
    subjectName: subjectName || null,
    loggedBy: actor.session.user?.name || "Staff",
  });

  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

async function postModLogToDiscord(entry: {
  reportId: string;
  title: string;
  description: string | null;
  category: string;
  subjectDiscordId: string | null;
  subjectName: string | null;
  loggedBy: string;
}) {
  try {
    const setting = await (db as any).appSetting.findUnique({
      where: { key: MODLOG_CHANNEL_KEY },
      select: { value: true },
    });
    const channelId = (setting?.value || "").trim();
    if (!channelId) return;

    const subjectLine = entry.subjectDiscordId
      ? `<@${entry.subjectDiscordId}>${entry.subjectName ? ` (${entry.subjectName})` : ""} \`${entry.subjectDiscordId}\``
      : entry.subjectName || "Unknown member";

    const link = `${getAppBaseUrl()}/reports/${entry.reportId}`;
    const parts = [
      "**📋 New mod-log entry**",
      `**${entry.title}**`,
      `Member: ${subjectLine}`,
      `Category: ${entry.category}`,
      ...(entry.description ? [entry.description.slice(0, 1500)] : []),
      `Logged by ${entry.loggedBy}`,
      link,
    ];

    await sendDiscordChannelMessage(channelId, parts.join("\n"));
  } catch (error) {
    // Notifying Discord is best-effort; never block the entry from being saved.
    console.error("Failed to post mod-log entry to Discord", error);
  }
}

// ---------- Mod-log settings ----------

export async function getModLogSettings() {
  const session = await auth();
  if (!session?.user?.id) return { channelId: "" };

  const setting = await (db as any).appSetting.findUnique({
    where: { key: MODLOG_CHANNEL_KEY },
    select: { value: true },
  });
  return { channelId: setting?.value || "" };
}

export async function saveModLogSettings(input: { channelId?: string }) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(canManageReports(actor.permissions));
  if (denied) throw new Error(denied.error);

  const channelId = (input.channelId || "").trim();
  if (channelId) {
    await (db as any).appSetting.upsert({
      where: { key: MODLOG_CHANNEL_KEY },
      create: { key: MODLOG_CHANNEL_KEY, value: channelId },
      update: { value: channelId },
    });
  } else {
    await (db as any).appSetting.deleteMany({ where: { key: MODLOG_CHANNEL_KEY } });
  }

  revalidatePath("/settings");
  return { channelId };
}

export async function getModLogMembers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const staff = await getStaffUsers();
  return staff
    .filter((member) => !!member.discordId)
    .map((member) => ({
      discordId: member.discordId as string,
      name: member.name,
    }));
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
