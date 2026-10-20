export type DiscordMention = { name: string; discordId: string };
export function formatDiscordComment(content: string, mentions: DiscordMention[]) {
  let text = content.replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g, "$1");
  const users: string[] = [];
  for (const mention of mentions) {
    if (!/^\d+$/.test(mention.discordId)) continue;
    const token = mention.name.replace(/\s+/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!token) continue;
    const pattern = new RegExp(`@${token}(?![\\w])`, "g");
    if (pattern.test(text)) { text = text.replace(pattern, `<@${mention.discordId}>`); users.push(mention.discordId); }
  }
  return { content: text, allowed_mentions: { parse: [] as string[], users: [...new Set(users)], replied_user: false } };
}
export function splitDiscordMessage(content: string, limit = 2000): string[] {
  if (limit < 2) throw new Error("Message limit must be at least two characters.");
  const chunks: string[] = [];
  let remaining = content;
  while (remaining.length > limit) {
    let split = Math.max(remaining.lastIndexOf("\n", limit), remaining.lastIndexOf(" ", limit));
    if (split < limit / 2) split = limit;
    // UTF-16 surrogate pairs must stay together.
    if (split > 0 && /[\uD800-\uDBFF]/.test(remaining[split - 1])) split--;
    chunks.push(remaining.slice(0, split)); remaining = remaining.slice(split);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
export function discordCommentDisplay(content: string) {
  const withoutHeader = content.replace(/^\*\*Discord - [^\n]*\*\*\s*/, "");
  return withoutHeader.replace(/^Post: https?:\/\/discord\.com\/channels\/[^\s]+\s*/, "");
}

export function discordMessageUrl(threadId: string, messageId: string, guildId?: string | null, legacyContent = "") {
  const legacyGuild = legacyContent.match(/https?:\/\/discord\.com\/channels\/(\d+)\//)?.[1];
  return `https://discord.com/channels/${guildId || legacyGuild || "@me"}/${threadId}/${messageId}`;
}
