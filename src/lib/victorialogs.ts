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

export type VictoriaLogsQueryResult = {
  entries: VictoriaLogEntry[];
  skippedLines: number;
  requestDurationSeconds: string | null;
  accountId: string | null;
  projectId: string | null;
  error: string | null;
};

type VictoriaLogsConfig = {
  baseUrl: string | null;
  bearerToken: string | null;
  username: string | null;
  password: string | null;
  defaultAccountId: string | null;
  defaultProjectId: string | null;
};

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

function toEndpoint(baseUrl: string): URL {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("select/logsql/query", base);
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

export function isVictoriaLogsConfigured(): boolean {
  return !!getConfig().baseUrl;
}

export async function queryVictoriaLogs(
  input: VictoriaLogsQueryInput
): Promise<VictoriaLogsQueryResult> {
  const config = getConfig();
  if (!config.baseUrl) {
    return {
      entries: [],
      skippedLines: 0,
      requestDurationSeconds: null,
      accountId: null,
      projectId: null,
      error: "VictoriaLogs is not configured. Set VICTORIALOGS_URL first.",
    };
  }

  const endpoint = toEndpoint(config.baseUrl);
  const body = new URLSearchParams();
  body.set("query", input.query.trim() || "*");
  body.set("limit", String(clampLimit(input.limit)));

  const start = trimToNull(input.start);
  const end = trimToNull(input.end);
  const timeout = trimToNull(input.timeout);

  if (start) body.set("start", start);
  if (end) body.set("end", end);
  if (timeout) body.set("timeout", timeout);

  const accountId =
    sanitizeTenantId(trimToNull(input.accountId)) ?? config.defaultAccountId;
  const projectId =
    sanitizeTenantId(trimToNull(input.projectId)) ?? config.defaultProjectId;

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
    });

    if (!response.ok) {
      const responseText = await response.text();
      return {
        entries: [],
        skippedLines: 0,
        requestDurationSeconds: response.headers.get("VL-Request-Duration-Seconds"),
        accountId: response.headers.get("AccountID"),
        projectId: response.headers.get("ProjectID"),
        error: `VictoriaLogs query failed (${response.status} ${response.statusText}): ${responseText || "No response body."}`,
      };
    }

    const lines = (await response.text())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const entries: VictoriaLogEntry[] = [];
    let skippedLines = 0;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const normalized = normalizeEntry(parsed);
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
      requestDurationSeconds: response.headers.get("VL-Request-Duration-Seconds"),
      accountId: response.headers.get("AccountID"),
      projectId: response.headers.get("ProjectID"),
      error: null,
    };
  } catch (error) {
    return {
      entries: [],
      skippedLines: 0,
      requestDurationSeconds: null,
      accountId: accountId ?? null,
      projectId: projectId ?? null,
      error:
        error instanceof Error
          ? `Failed to contact VictoriaLogs: ${error.message}`
          : "Failed to contact VictoriaLogs.",
    };
  }
}
