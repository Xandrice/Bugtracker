export type VictoriaLogEntry = Record<string, string>;

export type VictoriaLogsQueryInput = {
  query: string;
  start?: string;
  end?: string;
  limit?: number;
  timeout?: string;
  accountId?: string;
  projectId?: string;
  extraFilters?: Record<string, string | string[]>;
  extraFilterQueries?: string[];
  hiddenFields?: string[];
};

export type VictoriaLogsAuthMode = "none" | "bearer" | "basic" | "incomplete-basic";

export type VictoriaLogsFailureStage =
  | "config"
  | "url"
  | "connect"
  | "tls"
  | "http"
  | "parse";

export type VictoriaLogsDebug = {
  stage: VictoriaLogsFailureStage | "ok";
  endpoint: string | null;
  host: string | null;
  protocol: string | null;
  authMode: VictoriaLogsAuthMode;
  accountId: string | null;
  projectId: string | null;
  elapsedMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  causeChain: string[];
  hint: string | null;
};

export type VictoriaLogsQueryResult = {
  entries: VictoriaLogEntry[];
  skippedLines: number;
  requestDurationSeconds: string | null;
  accountId: string | null;
  projectId: string | null;
  error: string | null;
  debug: VictoriaLogsDebug;
};

export type VictoriaLogsConnectionInfo = {
  configured: boolean;
  endpoint: string | null;
  host: string | null;
  protocol: string | null;
  authMode: VictoriaLogsAuthMode;
  defaultAccountId: string | null;
  defaultProjectId: string | null;
  urlIssue: string | null;
};

type Endpoint = "query" | "hits" | "facets" | "field_values";
const tenant = (value: string | undefined) => value && /^\d+$/.test(value) ? value : null;

export function getVictoriaLogsConnectionInfo(): VictoriaLogsConnectionInfo {
  const raw = process.env.VICTORIALOGS_URL?.trim();
  const authMode: VictoriaLogsAuthMode = process.env.VICTORIALOGS_BEARER_TOKEN ? "bearer" : process.env.VICTORIALOGS_USERNAME && process.env.VICTORIALOGS_PASSWORD ? "basic" : process.env.VICTORIALOGS_USERNAME || process.env.VICTORIALOGS_PASSWORD ? "incomplete-basic" : "none";
  let endpoint: URL | null = null;
  let urlIssue: string | null = null;
  try {
    if (!raw) throw new Error("Logging is not configured.");
    const configured = new URL(raw);
    endpoint = /\/select\/logsql\/(?:query|hits|facets|field_values)\/?$/.test(configured.pathname)
      ? configured
      : new URL("select/logsql/query", raw.endsWith("/") ? raw : `${raw}/`);
    endpoint.pathname = endpoint.pathname.replace(/\/(?:query|hits|facets|field_values)\/?$/, "/query");
    if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("Use an HTTP(S) log URL without embedded credentials.");
  } catch (error) { endpoint = null; urlIssue = error instanceof Error ? error.message : "Invalid log server URL."; }
  return { configured: !!raw, endpoint: endpoint?.toString() ?? null, host: endpoint?.host ?? null, protocol: endpoint?.protocol ?? null, authMode, defaultAccountId: tenant(process.env.VICTORIALOGS_ACCOUNT_ID), defaultProjectId: tenant(process.env.VICTORIALOGS_PROJECT_ID), urlIssue };
}
export function isVictoriaLogsConfigured() { return getVictoriaLogsConnectionInfo().configured; }

/** All API endpoints share credentials, tenant headers, filters, and bounded timeouts. */
async function requestVictoriaLogs(endpoint: Endpoint, input: VictoriaLogsQueryInput, options: Record<string, string | string[]> = {}) {
  const connection = getVictoriaLogsConnectionInfo();
  const accountId = tenant(input.accountId) ?? connection.defaultAccountId;
  const projectId = tenant(input.projectId) ?? connection.defaultProjectId;
  const debug: VictoriaLogsDebug = { stage: "config", endpoint: connection.endpoint, host: connection.host, protocol: connection.protocol, authMode: connection.authMode, accountId, projectId, elapsedMs: null, httpStatus: null, errorCode: null, causeChain: [], hint: null };
  const failure = (error: string) => ({ text: "", error, debug, accountId, projectId, requestDurationSeconds: null as string | null });
  if (!connection.endpoint) return failure(connection.urlIssue || "Logging is not configured.");
  if (connection.authMode === "incomplete-basic") return failure("Log server credentials are incomplete. Contact an administrator.");
  const url = new URL(connection.endpoint);
  url.pathname = url.pathname.replace(/query$/, endpoint);
  debug.endpoint = url.toString();
  const body = new URLSearchParams({ query: input.query || "*", timeout: input.timeout || "10s" });
  for (const [key, value] of Object.entries({ start: input.start, end: input.end, limit: String(Math.min(1000, Math.max(1, input.limit || 200))) })) if (value) body.set(key, value);
  if (input.extraFilters && Object.keys(input.extraFilters).length) body.set("extra_filters", JSON.stringify(input.extraFilters));
  for (const filter of input.extraFilterQueries || []) body.append("extra_filters", filter);
  if (input.hiddenFields?.length) body.set("hidden_fields_filters", JSON.stringify(input.hiddenFields));
  for (const [key, value] of Object.entries(options)) for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (accountId) headers.AccountID = accountId;
  if (projectId) headers.ProjectID = projectId;
  if (connection.authMode === "bearer") headers.Authorization = `Bearer ${process.env.VICTORIALOGS_BEARER_TOKEN}`;
  if (connection.authMode === "basic") headers.Authorization = `Basic ${Buffer.from(`${process.env.VICTORIALOGS_USERNAME}:${process.env.VICTORIALOGS_PASSWORD}`).toString("base64")}`;
  const started = Date.now();
  try {
    const response = await fetch(url, { method: "POST", body, headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    debug.httpStatus = response.status;
    debug.elapsedMs = Date.now() - started;
    if (!response.ok) {
      debug.stage = "http"; debug.errorCode = String(response.status);
      debug.causeChain = [(await response.text()).slice(0, 1000)];
      return failure(response.status === 408 || response.status === 504 ? "The log server took too long. Try a shorter time range." : response.status === 400 ? "The log server could not run this search. Check the filters or query." : "The log server is unavailable. Please try again or contact an administrator.");
    }
    debug.stage = "ok";
    return { text: await response.text(), error: null, debug, accountId, projectId, requestDurationSeconds: response.headers.get("VL-Request-Duration-Seconds") };
  } catch (error) {
    debug.stage = "connect"; debug.elapsedMs = Date.now() - started;
    debug.causeChain = [error instanceof Error ? error.message : "Connection failed"];
    return failure(error instanceof Error && /timeout|abort/i.test(error.name + error.message) ? "The log server took too long. Try a shorter time range." : "We couldn’t reach the log server. Try again in a moment.");
  }
}

export async function queryVictoriaLogs(input: VictoriaLogsQueryInput): Promise<VictoriaLogsQueryResult> {
  const response = await requestVictoriaLogs("query", input);
  const entries: VictoriaLogEntry[] = [];
  let skippedLines = 0;
  for (const line of response.text.split(/\r?\n/).filter(Boolean)) {
    try {
      const raw: unknown = JSON.parse(line);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid log row");
      entries.push(Object.fromEntries(Object.entries(raw).filter(([, value]) => value != null).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])));
    } catch { skippedLines++; }
  }
  return { entries, skippedLines, error: response.error || (skippedLines && !entries.length ? "The log server returned unreadable results. Please contact an administrator." : null), debug: response.debug, accountId: response.accountId, projectId: response.projectId, requestDurationSeconds: response.requestDurationSeconds };
}

export type LogHitSeries = { fields: Record<string, string>; timestamps: string[]; values: number[]; total: number };
export type LogFacet = { field_name: string; values: { field_value: string; hits: number }[] };
async function jsonRequest<T>(endpoint: Endpoint, input: VictoriaLogsQueryInput, options: Record<string, string | string[]> = {}) {
  const response = await requestVictoriaLogs(endpoint, input, options);
  if (response.error) return { data: null as T | null, error: response.error };
  try { return { data: JSON.parse(response.text) as T, error: null }; }
  catch { return { data: null as T | null, error: "The log server returned unreadable results." }; }
}
export function victoriaLogHits(input: VictoriaLogsQueryInput, step = "5m") { return jsonRequest<{ hits: LogHitSeries[] }>("hits", input, { step, field: ["resource", "event"], fields_limit: "50" }); }
export function victoriaLogFacets(input: VictoriaLogsQueryInput) { return jsonRequest<{ facets: LogFacet[] }>("facets", { ...input, limit: 8 }, { keep_const_fields: "1" }); }
export function victoriaLogFieldValues(input: VictoriaLogsQueryInput, field: "resource" | "event") { return jsonRequest<{ values: { value: string; hits: number }[] }>("field_values", { ...input, limit: 100 }, { field }); }
export async function victoriaLogsCsv(input: VictoriaLogsQueryInput) {
  const result = await requestVictoriaLogs("query", { ...input, limit: 1000 }, { format: "csv" });
  return { csv: result.text, error: result.error };
}
