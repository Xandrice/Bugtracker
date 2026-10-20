import { db } from "./db";
import { getDiscordChannelMessages, readDiscordChannel } from "./discord";
import { importDiscordMessage } from "./discord-inbound";

export async function syncIssueNotesFromDiscord(issueId: string) {
  const issue = await db.issue.findUnique({ where: { id: issueId }, select: { discordThreadId: true, discordMessageId: true, discordSyncedAt: true } });
  if (!issue?.discordThreadId) return { synced: 0, reason: "no-linked-thread" };
  const now = new Date();
  const claim = await db.issue.updateMany({ where: { id: issueId, OR: [{ discordSyncedAt: null }, { discordSyncedAt: { lt: new Date(Date.now() - 180000) } }] }, data: { discordSyncedAt: now } });
  if (!claim.count) return { synced: 0, reason: "recently-synced" };
  let synced = 0;
  try {
    const key = `discord.catchup.${issueId}`;
    const stored = await db.appSetting.findUnique({ where: { key } });
    type Range = { before: string; since: string | null };
    let ranges: Range[] = [];
    try {
      const raw: unknown = JSON.parse(stored?.value || "[]");
      if (Array.isArray(raw)) ranges = raw.filter((value): value is Range => !!value && typeof value.before === "string" && (value.since === null || (typeof value.since === "string" && Number.isFinite(Date.parse(value.since)))));
    } catch { /* Recover by scanning from the latest messages. */ }
    const cutoff = issue.discordSyncedAt ? new Date(issue.discordSyncedAt.getTime() - 180000).toISOString() : null;
    let guildId: string | undefined;
    try { guildId = (await readDiscordChannel(issue.discordThreadId)).guild_id; } catch { /* Message imports still work if channel metadata is unavailable. */ }
    for (let page = 0; page < 5; page++) {
      // Always fetch current replies, then resume older ranges left by a busy thread.
      const range = page === 0 ? null : ranges[0];
      if (page > 0 && !range) break;
      const messages = await getDiscordChannelMessages(issue.discordThreadId, 100, range?.before);
      if (!messages) throw new Error("Discord unavailable");
      for (const message of [...messages].reverse()) {
        if (message.id === issue.discordMessageId) continue;
        await importDiscordMessage(issueId, { ...message, guild_id: message.guild_id || guildId }); synced++;
      }
      const oldest = messages.at(-1);
      const since = range ? range.since : cutoff;
      const more = messages.length === 100 && oldest?.id && (!since || !oldest.timestamp || Date.parse(oldest.timestamp) >= Date.parse(since));
      if (range) {
        if (more) range.before = oldest!.id!;
        else ranges.shift();
      } else if (more) ranges.push({ before: oldest!.id!, since });
    }
    if (ranges.length) await db.appSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(ranges) }, update: { value: JSON.stringify(ranges) } });
    else await db.appSetting.deleteMany({ where: { key } });
    return { synced, reason: ranges.length ? "catchup-pending" : "ok" };
  } catch {
    await db.issue.updateMany({ where: { id: issueId, discordSyncedAt: now }, data: { discordSyncedAt: issue.discordSyncedAt } });
    return { synced, reason: "discord-fetch-failed" };
  }
}
