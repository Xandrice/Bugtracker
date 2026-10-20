import { LOG_CATEGORIES, type LogCategory } from "./log-events";
import { playerCitizenTagPattern, readLogParam, resolvePlayerLogRange, type PlayerLogParams } from "./player-logs";

export type LogFilters = {
  q: string; range: string; duration: string; start: string; end: string;
  player: string; category: string; resource: string; event: string;
  excludeResource: string; excludeEvent: string; before: string; cursorOffset: number;
  mode: "guided" | "advanced"; raw: string; accountId: string; projectId: string;
};
export function parseLogFilters(params: PlayerLogParams): LogFilters {
  const read = (key: string) => readLogParam(params[key]).trim().slice(0, key === "raw" ? 5000 : 500);
  const category = read("category");
  const before = read("before");
  if (before && !Number.isFinite(Date.parse(before))) throw new Error("Invalid paging time. Run the search again.");
  const offset = Number(read("offset") || "0");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new Error("Invalid page. Narrow your search.");
  return { q: read("q"), range: read("range") || "1h", duration: read("duration"), start: read("start"), end: read("end"), player: read("player"), category: LOG_CATEGORIES.includes(category as LogCategory) ? category : "", resource: read("resource"), event: read("event"), excludeResource: read("excludeResource"), excludeEvent: read("excludeEvent"), before, cursorOffset: offset, mode: read("mode") === "advanced" ? "advanced" : "guided", raw: read("raw"), accountId: read("accountId"), projectId: read("projectId") };
}

export type PlayerLogIdentity = { citizenid: string; license?: string | null; discord?: string | null };
export function playerIdentityQuery(identity: PlayerLogIdentity): string {
  const conditions = ["citizenid", "license", "discord"].flatMap((key) => {
    const raw = identity[key as keyof PlayerLogIdentity];
    if (!raw) return [];
    const value = raw.replace(new RegExp(`^${key}:`, "i"), "");
    const variants = key === "citizenid" ? [value] : [value, `${key}:${value}`];
    return variants.map(token => {
      if (!token || /[,\r\n]/.test(token)) throw new Error("This player has an invalid log identifier.");
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = key === "citizenid" ? playerCitizenTagPattern(token) : `(^|,)\\s*${key}:${escaped}(,|$)`;
      return `(${key}:=${JSON.stringify(token)} OR (tags:${JSON.stringify(`${key}:${token}`)} AND tags:~${JSON.stringify(pattern)}))`;
    });
  });
  if (!conditions.length) throw new Error("Choose a player with a usable identifier.");
  return `(${conditions.join(" OR ")})`;
}

export function buildGuidedLogsQuery(filters: LogFilters, identity?: PlayerLogIdentity, pairs?: { resource: string; event: string }[]) {
  const terms = filters.q.match(/\S+/g)?.map(word => JSON.stringify(word)) || [];
  if (identity) terms.push(playerIdentityQuery(identity));
  if (filters.excludeResource) terms.push(`NOT resource:=${JSON.stringify(filters.excludeResource)}`);
  if (filters.excludeEvent) terms.push(`NOT event:=${JSON.stringify(filters.excludeEvent)}`);
  if (filters.category && pairs) {
    terms.push(pairs.length ? `(${pairs.map(pair => `(resource:=${JSON.stringify(pair.resource)} AND event:=${JSON.stringify(pair.event)})`).join(" OR ")})` : "_time:<0");
  }
  const extraFilters: Record<string, string> = {};
  if (filters.resource) extraFilters.resource = filters.resource;
  if (filters.event) extraFilters.event = filters.event;
  const range = resolvePlayerLogRange({ range: filters.range, duration: filters.duration, start: filters.start, end: filters.end, limit: "200" });
  // end is exclusive; include the entire boundary timestamp and skip rows already seen there.
  const query = terms.join(" AND ") || "*";
  return { query, extraFilters, ...range };
}
