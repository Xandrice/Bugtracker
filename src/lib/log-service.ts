import "server-only";
import { canUseAdvancedLogs, canViewLogs, canViewStaffPlayers, type PermissionContext } from "./permissions";
import { buildGuidedLogsQuery, parseLogFilters, playerIdentityQuery, type PlayerLogIdentity } from "./log-filters";
import { describeLogEvent, logCategory, scrubLogEntry, type LogEntry } from "./log-events";
import { queryVictoriaLogs, victoriaLogFacets, victoriaLogFieldValues, victoriaLogHits, victoriaLogsCsv, type VictoriaLogsQueryInput } from "./victorialogs";
import type { PlayerLogParams } from "./player-logs";
import { getStaffPlayerLogIdentity } from "./fivem-db";

export const HIDDEN_LOG_FIELDS = ["ip", "ip_*", "player_ip", "client_ip", "remote_ip", "ipaddress", "ip_address", "address", "endpoint", "password*", "token*", "secret*", "authorization"];

export async function logEventCatalog(offset = 0) {
  const result = await queryVictoriaLogs({ query: `* | stats by (resource, event) count() as hits, row_any() as sample | sort by (resource, event) offset ${offset} limit 1000`, start: "7d", end: "now", limit: 1000 });
  return { pairs: result.entries.map(entry => {
    let sample: unknown = entry.sample;
    try { sample = JSON.parse(entry.sample || "null"); } catch { /* Keep the original field for diagnosis. */ }
    return { resource: entry.resource || "", event: entry.event || "", hits: Number(entry.hits) || 0, category: logCategory(entry.resource || "", entry.event || ""), sample };
  }), error: result.error };
}

export async function prepareLogSearch(params: PlayerLogParams, permissions: PermissionContext | null, lockedPlayer?: string) {
  if (!canViewLogs(permissions)) throw new Error("You do not have permission to view logs.");
  const advanced = canUseAdvancedLogs(permissions);
  const filters = parseLogFilters(params);
  if (filters.mode === "advanced" && !advanced) throw new Error("Advanced log access is required to run raw queries.");
  if ((filters.accountId || filters.projectId) && !advanced) throw new Error("Advanced log access is required to switch tenants.");
  let identity: PlayerLogIdentity | undefined;
  const player = lockedPlayer || filters.player;
  if (player) {
    if (!canViewStaffPlayers(permissions)) throw new Error("Player access is required to search player identities.");
    const matched = await getStaffPlayerLogIdentity(player);
    identity = matched || { citizenid: player };
  }
  let pairs;
  const validatedRange = buildGuidedLogsQuery(filters, identity);
  if (filters.category) {
    // Query all pairs in the requested range. These keys are escaped before becoming filters.
    const catalog = await queryVictoriaLogs({ ...validatedRange, query: "* | stats by (resource, event) count() | sort by (resource, event) limit 1000", limit: 1000, accountId: filters.accountId, projectId: filters.projectId, hiddenFields: advanced ? undefined : HIDDEN_LOG_FIELDS });
    if (catalog.error) throw new Error(catalog.error);
    if (catalog.entries.length === 1000) throw new Error("Too many event types for this category search. Choose a resource or a shorter time range.");
    pairs = catalog.entries.filter(entry => logCategory(entry.resource || "", entry.event || "") === filters.category).map(entry => ({ resource: entry.resource || "", event: entry.event || "" }));
  }
  const guided = buildGuidedLogsQuery(filters, identity, pairs);
  const input: VictoriaLogsQueryInput = { ...guided, query: filters.mode === "advanced" ? filters.raw || "*" : guided.query, ...(lockedPlayer && identity ? { extraFilterQueries: [playerIdentityQuery(identity)] } : {}), accountId: advanced ? filters.accountId : undefined, projectId: advanced ? filters.projectId : undefined, hiddenFields: advanced ? undefined : HIDDEN_LOG_FIELDS };
  return { filters, advanced, input, identity };
}

export async function searchLogs(params: PlayerLogParams, permissions: PermissionContext | null, lockedPlayer?: string, older = false) {
  const { filters, advanced, input } = await prepareLogSearch(params, permissions, lockedPlayer);
  const pageQuery = filters.mode === "advanced" ? input.query : `${input.query}${filters.before ? ` AND _time:<=${JSON.stringify(filters.before)}` : ""} | sort by (_time desc, _stream_id, _msg, tags) offset ${filters.cursorOffset} limit 200`;
  const milliseconds = Date.parse(input.end!) - Date.parse(input.start!);
  const step = `${Math.max(1, Math.ceil(milliseconds / 60000 / 48))}m`;
  const [rows, hits, facets, resources, events] = await Promise.all([
    queryVictoriaLogs({ ...input, query: pageQuery }),
    older ? Promise.resolve(null) : victoriaLogHits(input, step),
    older ? Promise.resolve(null) : victoriaLogFacets(input),
    older ? Promise.resolve(null) : victoriaLogFieldValues(input, "resource"),
    older ? Promise.resolve(null) : victoriaLogFieldValues(input, "event"),
  ]);
  const entries = advanced ? rows.entries : rows.entries.map(scrubLogEntry);
  const boundary = rows.entries.at(-1)?._time;
  const sameTime = boundary ? rows.entries.filter(entry => entry._time === boundary).length : 0;
  return {
    entries, error: rows.error, debug: advanced ? rows.debug : null,
    warning: [hits?.error, facets?.error, resources?.error, events?.error].find(Boolean) ? "Some timeline or filter suggestions could not be loaded. You can still use the results." : null,
    hits: hits?.data?.hits || [],
    facets: (facets?.data?.facets || []).filter(facet => ["resource", "event"].includes(facet.field_name)),
    resources: resources?.data?.values?.map(value => value.value) || [],
    events: events?.data?.values?.map(value => value.value) || [],
    next: filters.mode === "guided" && entries.length === 200 && boundary ? { before: boundary, offset: String(sameTime + (boundary === filters.before ? filters.cursorOffset : 0)) } : null,
    start: input.start!, end: input.end!, logsQL: advanced ? `${input.query}${Object.keys(input.extraFilters || {}).length ? ` AND ${Object.entries(input.extraFilters!).map(([key,value]) => `${key}:=${JSON.stringify(value)}`).join(" AND ")}` : ""}` : null,
  };
}

function csvValue(value: string) {
  // Avoid spreadsheet formula execution when moderators open exported chat/messages.
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function entriesCsv(entries: LogEntry[]) {
  const columns = [...new Set(entries.flatMap(entry => Object.keys(entry)))];
  return [columns.map(csvValue).join(","), ...entries.map(entry => columns.map(column => csvValue(entry[column] || "")).join(","))].join("\r\n");
}
export async function exportLogs(params: PlayerLogParams, permissions: PermissionContext | null) {
  const { input, filters } = await prepareLogSearch(params, permissions);
  const query = filters.mode === "advanced" ? input.query : `${input.query} | sort by (_time) desc limit 1000`;
  // Request VictoriaLogs CSV for advanced query compatibility; guided exports sanitize before delivery.
  if (filters.mode === "advanced") {
    const csv = await victoriaLogsCsv({ ...input, query });
    if (csv.error) throw new Error(csv.error);
    return csv.csv;
  }
  const result = await queryVictoriaLogs({ ...input, query, limit: 1000 });
  if (result.error) throw new Error(result.error);
  return entriesCsv(result.entries.map(scrubLogEntry));
}

export function logEvidence(entry: LogEntry) {
  const event = describeLogEvent(entry);
  return `Log evidence: ${event.summary}\nTime: ${entry._time || "Unknown"}\nResource: ${event.resource}\nEvent: ${event.event}\nPlayer: ${event.playerId || "Unknown"}`;
}
