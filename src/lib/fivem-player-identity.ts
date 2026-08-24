export const IDENTIFIER_PREFIXES = [
  "discord",
  "license2",
  "license",
  "steam",
  "fivem",
  "xbl",
  "live",
] as const;

const DISCORD_SNOWFLAKE = /^\d{16,20}$/;
const STEAM_HEX = /^1100001[0-9a-f]+$/i;
const LICENSE_HEX = /^[a-f0-9]{32,64}$/i;
const PREFIX_PATTERN = /^(discord|license2|license|steam|fivem|xbl|live):(.+)$/i;

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function getField(row: Record<string, unknown>, name: string): unknown {
  if (name in row) return row[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lower) return row[key];
  }
  return undefined;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

/**
 * Expand a staff search so bare ids and prefixed FiveM identifiers match
 * each other: `123…`, `discord:123…`, `license:xxx`, `steam:1100001…`.
 */
export function expandIdentifierSearchTerms(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const terms = new Set<string>([trimmed]);
  const prefixed = trimmed.match(PREFIX_PATTERN);
  const prefix = prefixed?.[1]?.toLowerCase() ?? null;
  const value = prefixed ? prefixed[2].trim() : trimmed;

  if (!value) return Array.from(terms);

  if (prefix) {
    terms.add(value);
    if (prefix === "license" || prefix === "license2") {
      terms.add(`license:${value}`);
      terms.add(`license2:${value}`);
    } else {
      terms.add(`${prefix}:${value}`);
    }
    return unique(Array.from(terms));
  }

  if (DISCORD_SNOWFLAKE.test(value)) {
    terms.add(`discord:${value}`);
  } else if (STEAM_HEX.test(value)) {
    terms.add(`steam:${value}`);
  } else if (LICENSE_HEX.test(value)) {
    terms.add(`license:${value}`);
    terms.add(`license2:${value}`);
  }

  return unique(Array.from(terms));
}

export function looksLikeIdentifierQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (PREFIX_PATTERN.test(trimmed)) return true;
  if (DISCORD_SNOWFLAKE.test(trimmed)) return true;
  if (STEAM_HEX.test(trimmed)) return true;
  if (LICENSE_HEX.test(trimmed)) return true;
  return false;
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function discordIdFromText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.match(/^discord:(\d{16,20})$/i);
  if (prefixed) return prefixed[1];
  if (DISCORD_SNOWFLAKE.test(trimmed)) return trimmed;
  const embedded = trimmed.match(/discord:(\d{16,20})/i);
  return embedded ? embedded[1] : null;
}

function discordIdFromUnknown(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return discordIdFromText(String(Math.trunc(value)));
  }
  if (typeof value === "string") {
    const parsed = parseJsonValue(value);
    if (parsed !== value) return discordIdFromUnknown(parsed);
    const direct = discordIdFromText(value);
    if (direct) return direct;
    for (const part of value.split(/[,\n;]/)) {
      const fromPart = discordIdFromText(part);
      if (fromPart) return fromPart;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = discordIdFromUnknown(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const discordField = record.discord ?? record.Discord;
    const fromField = discordIdFromUnknown(discordField);
    if (fromField) return fromField;
    for (const entry of Object.values(record)) {
      const found = discordIdFromUnknown(entry);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Pull a Discord snowflake out of a player/identifier row. Discord may live
 * in a dedicated column, an identifiers JSON object/array, or a `discord:` prefix.
 */
export function extractDiscordId(row: Record<string, unknown>): string | null {
  const discordField = normalizeText(getField(row, "discord"));
  if (discordField) {
    const fromColumn = discordIdFromUnknown(discordField);
    if (fromColumn) return fromColumn;
  }

  const identifiers = getField(row, "identifiers");
  if (identifiers != null) {
    const fromIdentifiers = discordIdFromUnknown(identifiers);
    if (fromIdentifiers) return fromIdentifiers;
  }

  for (const column of ["identifier", "license", "license2"]) {
    const value = normalizeText(getField(row, column));
    if (value?.toLowerCase().startsWith("discord:")) {
      const fromPrefixed = discordIdFromText(value);
      if (fromPrefixed) return fromPrefixed;
    }
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDurationMinutes(totalMinutes: number): string | null {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return null;
  const minutes = Math.floor(totalMinutes);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

/**
 * Format playtime as a short human duration (`12h 4m`).
 * QBCore `metadata.playtime` and most playtime columns are minutes.
 * Values too large to be minutes are treated as seconds.
 */
export function formatPlaytimeDuration(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    const hours = toFiniteNumber(record.hours ?? record.h) ?? 0;
    const minutes = toFiniteNumber(record.minutes ?? record.m) ?? 0;
    const seconds = toFiniteNumber(record.seconds ?? record.s) ?? 0;
    if (hours === 0 && minutes === 0 && seconds === 0 && record.hours == null && record.minutes == null) {
      return null;
    }
    return formatDurationMinutes(hours * 60 + minutes + seconds / 60);
  }

  const num = toFiniteNumber(value);
  if (num == null || num < 0) return null;

  const twentyYearsInMinutes = 20 * 365 * 24 * 60;
  if (num >= twentyYearsInMinutes) {
    return formatDurationMinutes(num / 60);
  }
  return formatDurationMinutes(num);
}

export function coercePresenceDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return null;
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : null;
    if (ms == null) return null;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber > 1e9) {
      return coercePresenceDate(asNumber);
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatPresenceDate(value: unknown): string | null {
  const date = coercePresenceDate(value);
  if (!date) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
