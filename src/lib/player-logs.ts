export type PlayerLogParams = Record<string, string | string[] | undefined>;

export const LOG_RANGES = [
  ["15m", "Last 15 minutes"], ["1h", "Last hour"], ["6h", "Last 6 hours"],
  ["24h", "Last 24 hours"], ["7d", "Last 7 days"],
  ["duration", "Custom duration"], ["dates", "Custom dates"],
] as const;

export function readLogParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function localLogDateInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function localLogDateToUtc(value: string): string {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime()) || localLogDateInput(date.toISOString()) !== (value.length === 16 ? `${value}:00` : value)) {
    throw new Error("Enter valid local start and end times. Times skipped by daylight saving are not valid.");
  }
  return date.toISOString();
}

export function parseLogDuration(value: string): number {
  if (!/^(?:\d+[smhd])+$/.test(value)) throw new Error("Enter a duration such as 90m, 3h, or 1h30m.");
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const milliseconds = Array.from(value.matchAll(/(\d+)([smhd])/g))
    .reduce((total, part) => total + Number(part[1]) * units[part[2]], 0);
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) throw new Error("Duration must be greater than zero and within the supported date range.");
  return milliseconds;
}

export function resolvePlayerLogRange(params: PlayerLogParams, now = Date.now()) {
  const range = readLogParam(params.range) || "1h";
  if (!LOG_RANGES.some(([value]) => value === range)) throw new Error("Choose a valid time range.");
  const limitText = readLogParam(params.limit) || "200";
  if (!["200", "500", "1000"].includes(limitText)) throw new Error("Choose a result limit of 200, 500, or 1,000.");
  let start: Date;
  let end: Date;
  if (range === "dates") {
    const startText = readLogParam(params.start);
    const endText = readLogParam(params.end);
    const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
    if (!utc.test(startText) || !utc.test(endText)) throw new Error("Enter both a valid start and end date and time.");
    start = new Date(startText);
    end = new Date(endText);
    // Reject dates JavaScript silently normalizes, such as February 30.
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
        start.toISOString().slice(0, 19) !== startText.slice(0, 19) ||
        end.toISOString().slice(0, 19) !== endText.slice(0, 19)) {
      throw new Error("Enter valid calendar dates and times.");
    }
  } else {
    const duration = range === "duration" ? readLogParam(params.duration).trim() : range;
    start = new Date(now - parseLogDuration(duration));
    end = new Date(now);
  }
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error("Time range is outside the supported dates.");
  if (start >= end) throw new Error("Start must be before end.");
  return { start: start.toISOString(), end: end.toISOString(), limit: Number(limitText) };
}

export function playerCitizenTagPattern(identifier: string): string {
  if (!identifier.trim() || /[,\r\n]/.test(identifier)) throw new Error("This player has no usable Citizen ID for log matching.");
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `(^|,)citizenid:${escaped}(,|$)`;
}

export function buildPlayerLogsQuery(identifier: string, limit: number): string {
  if (![200, 500, 1000].includes(limit)) throw new Error("Invalid log limit.");
  return `tags:~${JSON.stringify(playerCitizenTagPattern(identifier))} | sort by (_time) desc | limit ${limit}`;
}

export function playerProfileTab(params: PlayerLogParams, allowedLogs: boolean) {
  const tab = readLogParam(params.tab);
  return tab === "assets" || tab === "history" || (tab === "logs" && allowedLogs) ? tab : "overview";
}
