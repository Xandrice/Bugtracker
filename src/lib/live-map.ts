export const LIVE_MAP_STALE_AFTER_MS = 90_000;

export const LIVE_MAP_PUBLISHER_NOTE =
  "Live positions require a FiveM server or Renny publisher posting to POST /api/staff-tools/live-map. This repo does not read player XYZ from MySQL and does not invent coordinates.";

export type LiveMapSource = "fivem" | "renny";

export type LiveMapPlayer = {
  identifier: string;
  name: string | null;
  x: number;
  y: number;
  z: number | null;
  heading: number | null;
};

export type LiveMapIngest = {
  source: LiveMapSource;
  serverId: string | null;
  players: LiveMapPlayer[];
};

export type LiveMapSnapshot = {
  available: boolean;
  source: LiveMapSource | null;
  serverId: string | null;
  publisherRequired: boolean;
  note: string | null;
  players: LiveMapPlayer[];
  receivedAt: string | null;
  staleAfterMs: number;
};

export type ParseLiveMapIngestResult =
  | { ok: true; value: LiveMapIngest }
  | { ok: false; error: string };

const WORLD_MIN_X = -4000;
const WORLD_MAX_X = 4500;
const WORLD_MIN_Y = -4000;
const WORLD_MAX_Y = 8000;

type LiveMapStore = {
  source: LiveMapSource;
  serverId: string | null;
  players: LiveMapPlayer[];
  receivedAtMs: number;
};

let store: LiveMapStore | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function parseOptionalFiniteNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return parseFiniteNumber(value);
}

function parseSource(value: unknown): LiveMapSource | null {
  if (value === undefined || value === null) return "fivem";
  if (value === "fivem" || value === "renny") return value;
  return null;
}

function parsePlayer(value: unknown): LiveMapPlayer | null {
  if (!isRecord(value)) return null;
  const identifier = typeof value.identifier === "string" ? value.identifier.trim() : "";
  if (!identifier) return null;
  const x = parseFiniteNumber(value.x);
  const y = parseFiniteNumber(value.y);
  if (x === null || y === null) return null;
  const z = parseOptionalFiniteNumber(value.z);
  const heading = parseOptionalFiniteNumber(value.heading);
  if (z === undefined || heading === undefined) return null;
  const name =
    typeof value.name === "string" && value.name.trim() ? value.name.trim() : null;
  return { identifier, name, x, y, z, heading };
}

export function parseLiveMapIngest(body: unknown): ParseLiveMapIngestResult {
  if (body === null || body === undefined) {
    return { ok: false, error: "Invalid JSON body" };
  }
  if (!isRecord(body)) {
    return { ok: false, error: "Expected a JSON object" };
  }
  if (!Array.isArray(body.players)) {
    return { ok: false, error: "Missing required field: players" };
  }

  const source = parseSource(body.source);
  if (!source) {
    return { ok: false, error: "source must be \"fivem\" or \"renny\"" };
  }

  const serverId =
    typeof body.serverId === "string" && body.serverId.trim()
      ? body.serverId.trim()
      : null;

  const players: LiveMapPlayer[] = [];
  const seen = new Set<string>();
  for (const entry of body.players) {
    const player = parsePlayer(entry);
    if (!player) {
      return { ok: false, error: "Each player needs identifier, x, and y as finite numbers" };
    }
    if (seen.has(player.identifier)) continue;
    seen.add(player.identifier);
    players.push(player);
  }

  return { ok: true, value: { source, serverId, players } };
}

export function applyLiveMapIngest(
  ingest: LiveMapIngest,
  now = Date.now()
): { accepted: number; rejected: number } {
  store = {
    source: ingest.source,
    serverId: ingest.serverId,
    players: ingest.players.map((player) => ({ ...player })),
    receivedAtMs: now,
  };
  return { accepted: ingest.players.length, rejected: 0 };
}

export function getLiveMapSnapshot(now = Date.now()): LiveMapSnapshot {
  if (!store || now - store.receivedAtMs > LIVE_MAP_STALE_AFTER_MS) {
    return {
      available: false,
      source: null,
      serverId: null,
      publisherRequired: true,
      note: LIVE_MAP_PUBLISHER_NOTE,
      players: [],
      receivedAt: null,
      staleAfterMs: LIVE_MAP_STALE_AFTER_MS,
    };
  }

  return {
    available: true,
    source: store.source,
    serverId: store.serverId,
    publisherRequired: false,
    note: null,
    players: store.players.map((player) => ({ ...player })),
    receivedAt: new Date(store.receivedAtMs).toISOString(),
    staleAfterMs: LIVE_MAP_STALE_AFTER_MS,
  };
}

export function projectWorldToMap(
  worldX: number,
  worldY: number,
  width: number,
  height: number
): { x: number; y: number } {
  const spanX = WORLD_MAX_X - WORLD_MIN_X;
  const spanY = WORLD_MAX_Y - WORLD_MIN_Y;
  const x = ((worldX - WORLD_MIN_X) / spanX) * width;
  const y = ((WORLD_MAX_Y - worldY) / spanY) * height;
  return {
    x: Math.min(width, Math.max(0, x)),
    y: Math.min(height, Math.max(0, y)),
  };
}

export function liveMapSourceLabel(source: LiveMapSource | null): string {
  switch (source) {
    case "fivem":
      return "FiveM server";
    case "renny":
      return "Renny";
    case null:
      return "No publisher";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

export function resetLiveMapStoreForTests(): void {
  store = null;
}
