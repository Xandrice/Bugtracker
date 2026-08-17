type VictoriaLogEntry = Record<string, string>;

export type VictoriaLogsQueryInput = {
  query: string;
  start?: string;
  end?: string;
  limit?: number;
  timeout?: string;
  accountId?: string;
  projectId?: string;
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

type VictoriaLogsConfig = {
  baseUrl: string | null;
  bearerToken: string | null;
  username: string | null;
  password: string | null;
  defaultAccountId: string | null;
  defaultProjectId: string | null;
};

type ErrorLink = {
  name: string;
  message: string;
  code: string | null;
};

const FETCH_TIMEOUT_MS = 15_000;

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeTenantId(value: string | null): string | null {
  if (!value) return null;
  return /^\d+$/.test(value) ? value : null;
}

function getConfig(): VictoriaLogsConfig {
  return {
    baseUrl: trimToNull(process.env.VICTORIALOGS_URL),
    bearerToken: trimToNull(process.env.VICTORIALOGS_BEARER_TOKEN),
    username: trimToNull(process.env.VICTORIALOGS_USERNAME),
    password: trimToNull(process.env.VICTORIALOGS_PASSWORD),
    defaultAccountId: sanitizeTenantId(trimToNull(process.env.VICTORIALOGS_ACCOUNT_ID)),
    defaultProjectId: sanitizeTenantId(trimToNull(process.env.VICTORIALOGS_PROJECT_ID)),
  };
}

function getAuthMode(config: VictoriaLogsConfig): VictoriaLogsAuthMode {
  if (config.bearerToken) return "bearer";
  if (config.username && config.password) return "basic";
  if (config.username || config.password) return "incomplete-basic";
  return "none";
}

function toEndpoint(baseUrl: string): URL {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("select/logsql/query", base);
}

function describeHost(url: URL | null): string | null {
  if (!url) return null;
  return url.host || url.hostname || null;
}

function getAuthorizationHeader(config: VictoriaLogsConfig): string | null {
  if (config.bearerToken) {
    return `Bearer ${config.bearerToken}`;
  }

  if (config.username && config.password) {
    const encoded = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    return `Basic ${encoded}`;
  }

  return null;
}

function clampLimit(input: number | undefined): number {
  if (!Number.isFinite(input)) return 200;
  return Math.min(Math.max(Math.trunc(input as number), 1), 1000);
}

function normalizeEntry(value: unknown): VictoriaLogEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const output: VictoriaLogEntry = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (fieldValue === null || fieldValue === undefined) continue;
    if (typeof fieldValue === "string") {
      output[key] = fieldValue;
      continue;
    }

    try {
      output[key] = JSON.stringify(fieldValue);
    } catch {
      output[key] = String(fieldValue);
    }
  }

  return output;
}

function parseBaseUrl(baseUrl: string): { endpoint: URL } | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return {
      error: `VICTORIALOGS_URL is not a valid URL: "${baseUrl}". Include the protocol, for example https://logs.example.com:9428`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      error: `VICTORIALOGS_URL must use http or https (got ${parsed.protocol.replace(":", "")}).`,
    };
  }

  try {
    return { endpoint: toEndpoint(baseUrl) };
  } catch {
    return {
      error: `Could not build the VictoriaLogs query endpoint from "${baseUrl}".`,
    };
  }
}

function privateNetworkHint(hostname: string): string | null {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "This host is loopback. The app server cannot reach VictoriaLogs on your local machine unless both run in the same process network. Use a public URL, or run the app locally against localhost.";
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return "This looks like a private LAN address. Hosted deployments (Vercel, etc.) cannot reach it unless you expose VictoriaLogs publicly or through a tunnel.";
  }
  return null;
}

function collectErrorChain(error: unknown): ErrorLink[] {
  const chain: ErrorLink[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const err = current as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
    };

    const name = typeof err.name === "string" && err.name ? err.name : "Error";
    const message =
      typeof err.message === "string" && err.message ? err.message : String(current);
    const code = typeof err.code === "string" && err.code ? err.code : null;
    chain.push({ name, message, code });

    if (Array.isArray(err.errors) && err.errors.length > 0) {
      current = err.errors[0];
      continue;
    }

    current = err.cause;
  }

  return chain;
}

function formatCauseChain(chain: ErrorLink[]): string[] {
  return chain.map((link) => {
    const code = link.code ? ` [${link.code}]` : "";
    return `${link.name}${code}: ${link.message}`;
  });
}

function diagnoseFetchFailure(
  chain: ErrorLink[],
  endpoint: URL | null
): { stage: VictoriaLogsFailureStage; hint: string; errorCode: string | null } {
  const codes = new Set(chain.map((link) => link.code).filter((code): code is string => !!code));
  const blob = chain
    .map((link) => `${link.name} ${link.code ?? ""} ${link.message}`.toLowerCase())
    .join(" | ");
  const errorCode = [...codes][0] ?? chain.find((link) => link.code)?.code ?? null;
  const hostHint = endpoint ? privateNetworkHint(endpoint.hostname) : null;

  if (codes.has("ENOTFOUND") || codes.has("EAI_AGAIN") || blob.includes("getaddrinfo")) {
    return {
      stage: "connect",
      errorCode: errorCode ?? "ENOTFOUND",
      hint: `DNS lookup failed for ${endpoint?.hostname ?? "the configured host"}. Check VICTORIALOGS_URL spelling and that this server can resolve that hostname.`,
    };
  }

  if (codes.has("ECONNREFUSED")) {
    return {
      stage: "connect",
      errorCode: "ECONNREFUSED",
      hint:
        hostHint ??
        `Connection refused by ${endpoint?.host ?? "the host"}. VictoriaLogs is not listening on that host/port, or a firewall is rejecting the TCP connection.`,
    };
  }

  if (
    codes.has("ETIMEDOUT") ||
    codes.has("UND_ERR_CONNECT_TIMEOUT") ||
    codes.has("UND_ERR_HEADERS_TIMEOUT") ||
    blob.includes("aborted") ||
    blob.includes("timeout") ||
    chain.some((link) => link.name === "TimeoutError" || link.name === "AbortError")
  ) {
    return {
      stage: "connect",
      errorCode: errorCode ?? "ETIMEDOUT",
      hint:
        hostHint ??
        `Timed out after ${FETCH_TIMEOUT_MS / 1000}s reaching ${endpoint?.host ?? "the host"}. Check firewall/security-group rules and that this deployment can reach that URL.`,
    };
  }

  if (
    codes.has("ECONNRESET") ||
    blob.includes("socket hang up") ||
    blob.includes("econnreset")
  ) {
    return {
      stage: "connect",
      errorCode: errorCode ?? "ECONNRESET",
      hint: `The remote closed the connection. Common causes: http vs https mismatch, a reverse proxy reset, or VictoriaLogs crashing mid-request.`,
    };
  }

  if (
    blob.includes("certificate") ||
    blob.includes("ssl") ||
    blob.includes("tls") ||
    codes.has("UNABLE_TO_VERIFY_LEAF_SIGNATURE") ||
    codes.has("CERT_HAS_EXPIRED") ||
    codes.has("ERR_TLS_CERT_ALTNAME_INVALID")
  ) {
    return {
      stage: "tls",
      errorCode: errorCode ?? "TLS",
      hint: "TLS handshake failed. Confirm VICTORIALOGS_URL uses the right protocol (https vs http) and that the certificate is valid for this hostname.",
    };
  }

  return {
    stage: "connect",
    errorCode,
    hint:
      hostHint ??
      "The HTTP client never got a response. Node often reports this as \"fetch failed\"; the cause chain below is the actual disconnect point.",
  };
}

function emptyDebug(partial: Partial<VictoriaLogsDebug> & Pick<VictoriaLogsDebug, "authMode">): VictoriaLogsDebug {
  return {
    stage: "config",
    endpoint: null,
    host: null,
    protocol: null,
    accountId: null,
    projectId: null,
    elapsedMs: null,
    httpStatus: null,
    errorCode: null,
    causeChain: [],
    hint: null,
    ...partial,
  };
}

function failedResult(
  error: string,
  debug: VictoriaLogsDebug,
  extras?: Partial<Pick<VictoriaLogsQueryResult, "accountId" | "projectId" | "requestDurationSeconds">>
): VictoriaLogsQueryResult {
  console.error("[VictoriaLogs]", {
    error,
    stage: debug.stage,
    endpoint: debug.endpoint,
    host: debug.host,
    authMode: debug.authMode,
    accountId: debug.accountId,
    projectId: debug.projectId,
    elapsedMs: debug.elapsedMs,
    httpStatus: debug.httpStatus,
    errorCode: debug.errorCode,
    causeChain: debug.causeChain,
    hint: debug.hint,
  });

  return {
    entries: [],
    skippedLines: 0,
    requestDurationSeconds: extras?.requestDurationSeconds ?? null,
    accountId: extras?.accountId ?? debug.accountId,
    projectId: extras?.projectId ?? debug.projectId,
    error,
    debug,
  };
}

export function isVictoriaLogsConfigured(): boolean {
  return !!getConfig().baseUrl;
}

export function getVictoriaLogsConnectionInfo(): VictoriaLogsConnectionInfo {
  const config = getConfig();
  if (!config.baseUrl) {
    return {
      configured: false,
      endpoint: null,
      host: null,
      protocol: null,
      authMode: getAuthMode(config),
      defaultAccountId: config.defaultAccountId,
      defaultProjectId: config.defaultProjectId,
      urlIssue: "VICTORIALOGS_URL is not set.",
    };
  }

  const parsed = parseBaseUrl(config.baseUrl);
  if ("error" in parsed) {
    return {
      configured: true,
      endpoint: null,
      host: null,
      protocol: null,
      authMode: getAuthMode(config),
      defaultAccountId: config.defaultAccountId,
      defaultProjectId: config.defaultProjectId,
      urlIssue: parsed.error,
    };
  }

  return {
    configured: true,
    endpoint: parsed.endpoint.toString(),
    host: describeHost(parsed.endpoint),
    protocol: parsed.endpoint.protocol.replace(":", ""),
    authMode: getAuthMode(config),
    defaultAccountId: config.defaultAccountId,
    defaultProjectId: config.defaultProjectId,
    urlIssue: privateNetworkHint(parsed.endpoint.hostname),
  };
}

export async function queryVictoriaLogs(
  input: VictoriaLogsQueryInput
): Promise<VictoriaLogsQueryResult> {
  const config = getConfig();
  const authMode = getAuthMode(config);
  const startedAt = Date.now();

  if (!config.baseUrl) {
    return failedResult(
      "VictoriaLogs is not configured. Set VICTORIALOGS_URL first.",
      emptyDebug({
        authMode,
        stage: "config",
        hint: "Add VICTORIALOGS_URL in the app environment, then redeploy.",
      })
    );
  }

  const parsed = parseBaseUrl(config.baseUrl);
  if ("error" in parsed) {
    return failedResult(
      parsed.error,
      emptyDebug({
        authMode,
        stage: "url",
        hint: parsed.error,
      })
    );
  }

  const endpoint = parsed.endpoint;
  const accountId =
    sanitizeTenantId(trimToNull(input.accountId)) ?? config.defaultAccountId;
  const projectId =
    sanitizeTenantId(trimToNull(input.projectId)) ?? config.defaultProjectId;

  const debugBase = emptyDebug({
    authMode,
    endpoint: endpoint.toString(),
    host: describeHost(endpoint),
    protocol: endpoint.protocol.replace(":", ""),
    accountId,
    projectId,
  });

  if (authMode === "incomplete-basic") {
    return failedResult(
      "VictoriaLogs basic auth is incomplete. Set both VICTORIALOGS_USERNAME and VICTORIALOGS_PASSWORD.",
      { ...debugBase, stage: "config", hint: "Username or password is missing, so the request would be sent without Authorization." }
    );
  }

  const body = new URLSearchParams();
  body.set("query", input.query.trim() || "*");
  body.set("limit", String(clampLimit(input.limit)));

  const start = trimToNull(input.start);
  const end = trimToNull(input.end);
  const timeout = trimToNull(input.timeout);

  if (start) body.set("start", start);
  if (end) body.set("end", end);
  if (timeout) body.set("timeout", timeout);

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (accountId) headers.set("AccountID", accountId);
  if (projectId) headers.set("ProjectID", projectId);

  const authHeader = getAuthorizationHeader(config);
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: body.toString(),
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const elapsedMs = Date.now() - startedAt;
    const responseAccountId = response.headers.get("AccountID") ?? accountId;
    const responseProjectId = response.headers.get("ProjectID") ?? projectId;
    const requestDurationSeconds = response.headers.get("VL-Request-Duration-Seconds");

    if (!response.ok) {
      const responseText = (await response.text()).trim();
      const hint =
        response.status === 401 || response.status === 403
          ? "VictoriaLogs rejected the credentials. Check VICTORIALOGS_BEARER_TOKEN or username/password."
          : response.status === 400
            ? "VictoriaLogs rejected the LogsQL query or time range. Check query syntax."
            : response.status === 404
              ? "The query path was not found. Confirm VICTORIALOGS_URL is the VictoriaLogs base URL, not Grafana or a reverse-proxy subpath that does not forward /select/logsql/query."
              : response.status >= 500
                ? "VictoriaLogs returned a server error. The connection succeeded; the backend failed while handling the query."
                : "The HTTP request reached VictoriaLogs, but the query was not accepted.";

      return failedResult(
        `VictoriaLogs query failed (${response.status} ${response.statusText}): ${responseText || "No response body."}`,
        {
          ...debugBase,
          stage: "http",
          elapsedMs,
          httpStatus: response.status,
          errorCode: String(response.status),
          hint,
          accountId: responseAccountId,
          projectId: responseProjectId,
        },
        {
          accountId: responseAccountId,
          projectId: responseProjectId,
          requestDurationSeconds,
        }
      );
    }

    const lines = (await response.text())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const entries: VictoriaLogEntry[] = [];
    let skippedLines = 0;

    for (const line of lines) {
      try {
        const parsedLine = JSON.parse(line);
        const normalized = normalizeEntry(parsedLine);
        if (normalized) {
          entries.push(normalized);
        } else {
          skippedLines += 1;
        }
      } catch {
        skippedLines += 1;
      }
    }

    return {
      entries,
      skippedLines,
      requestDurationSeconds,
      accountId: responseAccountId,
      projectId: responseProjectId,
      error: null,
      debug: {
        ...debugBase,
        stage: "ok",
        elapsedMs,
        httpStatus: response.status,
        accountId: responseAccountId,
        projectId: responseProjectId,
      },
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const chain = collectErrorChain(error);
    const diagnosis = diagnoseFetchFailure(chain, endpoint);
    const topMessage = chain[0]?.message || (error instanceof Error ? error.message : "Unknown error");

    return failedResult(`Failed to contact VictoriaLogs: ${topMessage}`, {
      ...debugBase,
      stage: diagnosis.stage,
      elapsedMs,
      errorCode: diagnosis.errorCode,
      causeChain: formatCauseChain(chain),
      hint: diagnosis.hint,
    });
  }
}
