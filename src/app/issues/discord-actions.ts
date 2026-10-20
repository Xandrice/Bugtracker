"use server";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { canAssignIssues, canManageNote, getPermissionContext } from "@/lib/permissions";
import { deliverIssueComment } from "@/lib/discord-chat";
import { createDiscordForumPost, getAppBaseUrl } from "@/lib/discord";
import { formatIssueRef } from "@/lib/issue-ids";
import { revalidatePath } from "next/cache";
import { pgTable } from "@/lib/pg-schema";

export async function retryDiscordComment(noteId: string) {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  const note = await db.note.findUnique({ where: { id: noteId } });
  if (!note || !canManageNote(permissions, note.authorId) || note.internal || !note.issueId || note.source !== "APP") throw new Error("You cannot retry this comment.");
  await deliverIssueComment(note.id);
  revalidatePath(`/issues/${note.issueId}`);
  const current = await db.note.findUnique({ where: { id: note.id }, select: { discordSyncStatus: true } });
  if (current?.discordSyncStatus === "FAILED") throw new Error("Discord is still unavailable. Your comment remains saved.");
}
export async function startIssueDiscordThread(issueId: string) {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  if (!canAssignIssues(permissions)) throw new Error("You cannot start a Discord thread.");
  // A DB lock avoids duplicate forum posts from concurrent clicks.
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM ${pgTable("Issue")} WHERE id = ${issueId} FOR UPDATE`;
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.discordThreadId) return;
    const setting = await tx.appSetting.findUnique({ where: { key: issue.type === "FEATURE" ? "discord.forum.suggestions" : "discord.forum.bugs" } });
    if (!setting?.value || !/^\d+$/.test(setting.value)) throw new Error("An administrator must configure the Discord forum first.");
    const ref = formatIssueRef(issue.publicKey, issue.id);
    const thread = await createDiscordForumPost(setting.value, `${ref}: ${issue.title}`, `${(issue.description || issue.title).slice(0, 1600)}\n\nTrack it here: ${getAppBaseUrl()}/issues/${ref}`);
    await tx.issue.update({ where: { id: issueId }, data: { discordThreadId: thread.id, discordChannelId: setting.value } });
  }, { timeout: 20000 });
  revalidatePath(`/issues/${issueId}`);
}
