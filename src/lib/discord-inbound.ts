import { Prisma } from "@prisma/client";
import { db } from "./db";
import { getOrCreateUserFromDiscordId } from "./discord-intake";
import { getDiscordChannelMessage } from "./discord";
import { deleteDiscordIssueComment, isOwnDiscordWebhook } from "./discord-chat";

export type InboundDiscordMessage = { id?: string; channel_id?: string; guild_id?: string; content?: string; timestamp?: string; edited_timestamp?: string; webhook_id?: string; author?: { id?: string; username?: string; global_name?: string; avatar?: string; bot?: boolean }; attachments?: { url?: string }[] };
export function inboundMessageContent(message: InboundDiscordMessage) {
  const links = (message.attachments || []).map(item => item.url).filter(Boolean);
  return [message.content?.trim() || "_(no text content)_", ...(links.length ? [`Attachments:\n${links.join("\n")}`] : [])].join("\n\n");
}
export async function importDiscordMessage(issueId: string, message: InboundDiscordMessage) {
  if (!message.id || message.author?.bot || await isOwnDiscordWebhook(message.webhook_id)) return;
  const existing = await db.note.findUnique({ where: { discordMessageId: message.id } });
  if (existing && (existing.source !== "DISCORD" || existing.issueId !== issueId)) return;
  if (existing) {
    if (message.content === undefined) return;
    await db.note.update({ where: { id: existing.id }, data: { content: inboundMessageContent(message), ...(message.guild_id ? { discordDelivery: { guildId: message.guild_id } } : {}), ...(message.timestamp && Number.isFinite(Date.parse(message.timestamp)) ? { createdAt: new Date(message.timestamp) } : {}) } });
    return;
  }
  if (!message.author?.id) return;
  const author = await getOrCreateUserFromDiscordId(message.author.id, message.author.global_name || message.author.username, message.author.avatar);
  try {
    await db.note.create({ data: { issueId, authorId: author.id, source: "DISCORD", content: inboundMessageContent(message), discordMessageId: message.id, discordAuthorId: message.author.id, discordAuthorTag: message.author.global_name || message.author.username, ...(message.guild_id ? { discordDelivery: { guildId: message.guild_id } } : {}), ...(message.timestamp && Number.isFinite(Date.parse(message.timestamp)) ? { createdAt: new Date(message.timestamp) } : {}) } });
  } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error; }
}
export async function updateInboundDiscordMessage(data: InboundDiscordMessage, deleted = false) {
  if (!data.id || !data.channel_id || (!deleted && await isOwnDiscordWebhook(data.webhook_id))) return;
  const issue = await db.issue.findUnique({ where: { discordThreadId: data.channel_id }, select: { id: true } });
  if (!issue) return;
  const note = await db.note.findFirst({ where: { issueId: issue.id, ...(deleted ? { OR: [
    { discordMessageId: data.id },
    { discordDelivery: { path: ["parts"], array_contains: [{ id: data.id, transport: "webhook" }] } },
    { discordDelivery: { path: ["parts"], array_contains: [{ id: data.id, transport: "bot" }] } },
  ] } : { discordMessageId: data.id, source: "DISCORD" }) } });
  if (!note) return;
  if (deleted) {
    // Outbound chunk removal and comment deletion produce gateway events too.
    if (["SENDING", "DELETING"].includes(note.discordSyncStatus)) return;
    await deleteDiscordIssueComment(note.id);
    return issue.id;
  }
  // Gateway updates are partial. Fetch the full message to preserve attachments and author data.
  const full = await getDiscordChannelMessage(data.channel_id, data.id);
  if (full) await importDiscordMessage(issue.id, full);
  else if (data.content !== undefined) await db.note.update({ where: { id: note.id }, data: { content: data.attachments ? inboundMessageContent(data) : `${data.content}${note.content.includes("\n\nAttachments:") ? note.content.slice(note.content.indexOf("\n\nAttachments:")) : ""}` } });
  return issue.id;
}
