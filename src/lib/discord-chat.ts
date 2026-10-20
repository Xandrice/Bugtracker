import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { formatDiscordComment, splitDiscordMessage } from "./discord-format";
import { createForumWebhook, deleteBotThreadMessage, deleteWebhookMessage, editBotThreadMessage, editWebhookMessage, readDiscordChannel, sendBotThreadMessage, sendWebhookMessage, setDiscordThreadArchived, type ForumWebhook } from "./discord";

type Delivery = { parts: { id: string; transport: "webhook" | "bot" }[]; parentId: string };
export function readDelivery(raw: Prisma.JsonValue | null): Delivery | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, Prisma.JsonValue>;
  if (!Array.isArray(value.parts) || typeof value.parentId !== "string") return null;
  const parts = value.parts.filter((part): part is { id: string; transport: "bot" | "webhook" } => !!part && typeof part === "object" && !Array.isArray(part) && typeof part.id === "string" && (part.transport === "webhook" || part.transport === "bot"));
  return { parts, parentId: value.parentId };
}
const webhookKey = (parentId: string) => `discord.webhook.${parentId}`;
async function storedWebhook(parentId: string): Promise<ForumWebhook | null> {
  const setting = await db.appSetting.findUnique({ where: { key: webhookKey(parentId) } });
  try { const data = JSON.parse(setting?.value || "null") as ForumWebhook | null; return data?.id && data?.token ? data : null; } catch { return null; }
}
export async function findOrCreateForumWebhook(parentId: string) {
  const stored = await storedWebhook(parentId); if (stored) return stored;
  const webhook = await createForumWebhook(parentId);
  await db.appSetting.upsert({ where: { key: webhookKey(parentId) }, create: { key: webhookKey(parentId), value: JSON.stringify(webhook) }, update: { value: JSON.stringify(webhook) } });
  return webhook;
}
export async function isOwnDiscordWebhook(id: string | undefined) {
  if (!id) return false;
  const settings = await db.appSetting.findMany({ where: { key: { startsWith: "discord.webhook." } }, select: { value: true } });
  return settings.some(setting => { try { return JSON.parse(setting.value).id === id; } catch { return false; } });
}
async function noteMentions() {
  const accounts = await db.account.findMany({ where: { provider: "discord" }, select: { providerAccountId: true, user: { select: { name: true } } } });
  const members = new Set((await db.projectMember.findMany({ select: { discordId: true } })).map(member => member.discordId));
  return accounts.filter(account => account.user.name && members.has(account.providerAccountId)).map(account => ({ name: account.user.name!, discordId: account.providerAccountId }));
}
async function removePart(threadId: string, parentId: string, part: Delivery["parts"][number]) {
  if (part.transport === "bot") return deleteBotThreadMessage(threadId, part.id);
  const webhook = await storedWebhook(parentId);
  if (!webhook) throw new Error("The Discord webhook is missing. Ask an administrator to restore it.");
  await deleteWebhookMessage(webhook, threadId, part.id);
}

/** Claims one delivery at a time, then persists each part so retries resume partial sends. */
export async function deliverIssueComment(noteId: string) {
  const claim = await db.note.updateMany({ where: { id: noteId, internal: false, source: "APP", OR: [{ discordSyncStatus: { in: ["PENDING", "FAILED"] } }, { discordSyncStatus: "SENDING", updatedAt: { lt: new Date(Date.now() - 300000) } }] }, data: { discordSyncStatus: "SENDING" } });
  if (!claim.count) return;
  let delivery: Delivery | null = null;
  try {
    const note = await db.note.findUnique({ where: { id: noteId }, include: { author: true, issue: true } });
    if (!note?.issue?.discordThreadId || note.internal) { await db.note.update({ where: { id: noteId }, data: { discordSyncStatus: "NONE" } }); return; }
    const threadId = note.issue.discordThreadId;
    const channel = await readDiscordChannel(threadId);
    const parentId = channel.parent_id || note.issue.discordChannelId;
    if (!parentId) throw new Error("This thread has no parent forum.");
    if (note.issue.discordChannelId !== parentId) await db.issue.update({ where: { id: note.issue.id }, data: { discordChannelId: parentId } });
    if (channel.thread_metadata?.archived) await setDiscordThreadArchived(threadId, false);
    delivery = readDelivery(note.discordDelivery) || { parentId, parts: note.discordMessageId ? [{ id: note.discordMessageId, transport: "bot" }] : [] };
    const formatted = formatDiscordComment(note.content, await noteMentions());
    let webhook: ForumWebhook | null = await storedWebhook(parentId);
    if (!webhook && !delivery.parts.some(part => part.transport === "bot")) {
      try { webhook = await findOrCreateForumWebhook(parentId); } catch { webhook = null; }
    }
    const useBot = delivery.parts.some(part => part.transport === "bot") || !webhook;
    const prefix = useBot ? `${(note.author.name || "Staff").slice(0, 80)} (tracker):\n` : "";
    const chunks = splitDiscordMessage(formatted.content, 2000 - prefix.length);
    for (let index = 0; index < chunks.length; index++) {
      const existing = delivery.parts[index];
      const payload = { content: `${useBot ? prefix : ""}${chunks[index]}`, allowed_mentions: formatted.allowed_mentions, username: (note.author.name || "Staff").slice(0, 80), ...(note.author.image ? { avatar_url: note.author.image } : {}) };
      if (existing) {
        if (existing.transport === "webhook") { if (!webhook) throw new Error("Webhook unavailable."); await editWebhookMessage(webhook, threadId, existing.id, payload); }
        else await editBotThreadMessage(threadId, existing.id, payload);
      } else {
        const nonce = createHash("sha256").update(`${note.id}:${index}`).digest("hex").slice(0, 24);
        const sent = useBot ? await sendBotThreadMessage(threadId, { content: payload.content, allowed_mentions: payload.allowed_mentions, nonce, enforce_nonce: true }) : await sendWebhookMessage(webhook!, threadId, payload);
        if (!sent?.id) throw new Error("Discord did not return a message ID.");
        delivery.parts.push({ id: sent.id, transport: useBot ? "bot" : "webhook" });
        await db.note.update({ where: { id: noteId }, data: { discordMessageId: delivery.parts[0].id, discordDelivery: delivery as unknown as Prisma.InputJsonValue } });
      }
    }
    while (delivery.parts.length > chunks.length) { await removePart(threadId, parentId, delivery.parts.at(-1)!); delivery.parts.pop(); await db.note.update({ where: { id: noteId }, data: { discordDelivery: delivery as unknown as Prisma.InputJsonValue } }); }
    await db.note.update({ where: { id: noteId }, data: { discordSyncStatus: "SENT", discordDelivery: delivery as unknown as Prisma.InputJsonValue } });
    if (note.issue.status === "DONE" && await archiveOnResolve()) await setDiscordThreadArchived(threadId, true);
  } catch {
    // Do not log webhook URLs/tokens or comment bodies.
    await db.note.updateMany({ where: { id: noteId }, data: { discordSyncStatus: "FAILED", ...(delivery ? { discordDelivery: delivery as unknown as Prisma.InputJsonValue } : {}) } });
  }
}
export async function archiveOnResolve() {
  return (await db.appSetting.findUnique({ where: { key: "discord.archiveOnResolve" } }))?.value === "true";
}
export async function syncDiscordIssueStatus(issueId: string, status: string, actorName: string) {
  const issue = await db.issue.findUnique({ where: { id: issueId }, select: { discordThreadId: true } });
  if (!issue?.discordThreadId) return;
  try {
    const channel = await readDiscordChannel(issue.discordThreadId);
    if (channel.thread_metadata?.archived) await setDiscordThreadArchived(issue.discordThreadId, false);
    await sendBotThreadMessage(issue.discordThreadId, { content: `${actorName} changed the issue status to ${status.replace(/_/g, " ").toLowerCase()}.`, allowed_mentions: { parse: [] } });
    if (await archiveOnResolve()) await setDiscordThreadArchived(issue.discordThreadId, status === "DONE");
  } catch { console.error("Issue saved, but its Discord status update could not be sent."); }
}
export async function deleteDiscordIssueComment(noteId: string) {
  const note = await db.note.findUnique({ where: { id: noteId }, include: { issue: true } });
  if (!note) return;
  const previousStatus = note.discordSyncStatus;
  const claimed = await db.note.updateMany({ where: { id: noteId, updatedAt: note.updatedAt, OR: [
    { discordSyncStatus: { notIn: ["SENDING", "DELETING"] } },
    { discordSyncStatus: "DELETING", updatedAt: { lt: new Date(Date.now() - 300000) } },
  ] }, data: { discordSyncStatus: "DELETING" } });
  if (!claimed.count) throw new Error("This comment changed or is syncing. Refresh and try again.");
  try {
    if (note.issue?.discordThreadId && note.discordMessageId) {
      const delivery = readDelivery(note.discordDelivery);
      if (delivery) for (const part of delivery.parts) await removePart(note.issue.discordThreadId, delivery.parentId, part);
      else await deleteBotThreadMessage(note.issue.discordThreadId, note.discordMessageId);
    }
    await db.note.deleteMany({ where: { id: noteId, discordSyncStatus: "DELETING" } });
  } catch (error) {
    await db.note.updateMany({ where: { id: noteId, discordSyncStatus: "DELETING" }, data: { discordSyncStatus: previousStatus === "DELETING" ? "SENT" : previousStatus } });
    throw error;
  }
}
