export type LogEntry = Record<string, string>;
export const LOG_CATEGORIES = ["Money", "Items", "Vehicles", "Combat", "Chat", "Connections", "Jobs", "Staff actions", "Errors", "Other"] as const;
export type LogCategory = typeof LOG_CATEGORIES[number];
export const CATEGORY_META: Record<LogCategory, { color: string; icon: string }> = {
  Money: { color: "#22c55e", icon: "$" }, Items: { color: "#a78bfa", icon: "◇" },
  Vehicles: { color: "#38bdf8", icon: "▣" }, Combat: { color: "#ef4444", icon: "⚔" },
  Chat: { color: "#facc15", icon: "✉" }, Connections: { color: "#2dd4bf", icon: "↔" },
  Jobs: { color: "#fb923c", icon: "▤" }, "Staff actions": { color: "#e879f9", icon: "◈" },
  Errors: { color: "#f87171", icon: "!" }, Other: { color: "#94a3b8", icon: "•" },
};

export function parseLogTags(tags: string | undefined): Record<string, string> {
  const fields: Record<string, string> = Object.create(null);
  for (const part of (tags ?? "").split(/,\s*/)) {
    const colon = part.indexOf(":");
    if (colon < 1) continue;
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (key && value) fields[key] = value;
  }
  return fields;
}

type CatalogEvent = { category: LogCategory; summary: (fields: LogEntry) => string };
const name = (fields: LogEntry) => fields.username || fields.player_name || fields.name || fields.citizenid || "A player";
const money = (fields: LogEntry) => {
  const amount = Number((fields.amount || "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) && fields.amount ? `$${amount.toLocaleString("en-US")}` : "money";
};
// Only explicit events get interpreted summaries. The catalog page exposes unmapped events.
export const EVENT_CATALOG: Record<string, CatalogEvent> = {
  "qb-banking:add_money": { category: "Money", summary: f => `${name(f)} received ${money(f)}${f.account ? ` (${f.account})` : ""}${f.from ? ` from ${f.from}` : ""}` },
  "qb-banking:remove_money": { category: "Money", summary: f => `${name(f)} spent ${money(f)}${f.account ? ` (${f.account})` : ""}` },
  "qb-inventory:add_item": { category: "Items", summary: f => `${name(f)} received ${f.count || f.amount || "an"} ${f.item || "item"}` },
  "qb-inventory:remove_item": { category: "Items", summary: f => `${name(f)} lost ${f.count || f.amount || "an"} ${f.item || "item"}` },
  "connections:connect": { category: "Connections", summary: f => `${name(f)} connected` },
  "connections:disconnect": { category: "Connections", summary: f => `${name(f)} disconnected${f.reason ? `: ${f.reason}` : ""}` },
};

export function logCategory(resource: string, event: string): LogCategory {
  const known = EVENT_CATALOG[`${resource}:${event}`];
  if (known) return known.category;
  const key = `${resource} ${event}`.toLowerCase();
  if (/error|exception|crash/.test(key)) return "Errors";
  if (/admin|staff|moderation/.test(key)) return "Staff actions";
  if (/bank|money|cash|payment|transfer/.test(key)) return "Money";
  if (/item|inventory|stash/.test(key)) return "Items";
  if (/vehicle|garage|impound/.test(key)) return "Vehicles";
  if (/death|kill|damage|combat/.test(key)) return "Combat";
  if (/connect|disconnect|join|leave/.test(key)) return "Connections";
  if (/chat|message/.test(key)) return "Chat";
  if (/job|duty|gang/.test(key)) return "Jobs";
  return "Other";
}

export function describeLogEvent(entry: LogEntry) {
  const fields = { ...parseLogTags(entry.tags), ...entry };
  const resource = fields.resource || "unknown";
  const event = fields.event || "unknown";
  const known = EVENT_CATALOG[`${resource}:${event}`];
  const category = known?.category || logCategory(resource, event);
  const fallback = entry._msg || `${resource} · ${event}${fields.citizenid ? ` · Player ${fields.citizenid}` : ""}`;
  return { resource, event, category, ...CATEGORY_META[category], summary: known ? known.summary(fields) : fallback, playerId: fields.citizenid || null, playerName: fields.username || fields.player_name || null, fields, known: !!known };
}

export const SENSITIVE_LOG_FIELD = /^(?:_stream|ip(?:_.*)?|.*_ip|ipaddress|ip_address|address|endpoint|password.*|pass|token.*|secret.*|authorization|license.*|discord.*|steam.*)$/i;
export function scrubLogEntry(entry: LogEntry): LogEntry {
  const safe = Object.fromEntries(Object.entries(entry).filter(([key]) => !SENSITIVE_LOG_FIELD.test(key)));
  const redact = (value: string) => value
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "[IP hidden]")
    .replace(/(?<![\w:])(?:[a-f0-9]{0,4}:){2,}[a-f0-9:.]*(?:%[a-z0-9]+)?(?![\w:])/gi, token => token.includes("::") || (token.match(/:/g)?.length || 0) >= 7 ? "[IP hidden]" : token)
    .replace(/\b(?:license2?|discord|steam):[^,\s]+/gi, "[identifier hidden]")
    .replace(/\b(?:password|token|secret|authorization)[:=]\s*[^,\s]+/gi, "[credential hidden]");
  if (safe.tags) safe.tags = Object.entries(parseLogTags(safe.tags)).filter(([key]) => !SENSITIVE_LOG_FIELD.test(key)).map(([key, value]) => `${key}:${redact(value)}`).join(",");
  return Object.fromEntries(Object.entries(safe).map(([key, value]) => [key, redact(value)]));
}
