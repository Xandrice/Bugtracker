import "server-only";

import mysql from "mysql2/promise";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type ColumnInfo = {
  tableName: string;
  columnName: string;
};

type TableSchema = {
  tableName: string;
  columns: string[];
  columnSet: Set<string>;
};

type SchemaSnapshot = {
  tables: TableSchema[];
  byName: Map<string, TableSchema>;
};

type PlayerTableCapabilities = {
  tableName: string;
  idColumn: string;
  displayNameColumn: string | null;
  firstNameColumn: string | null;
  lastNameColumn: string | null;
  profileJsonColumn: string | null;
  jobColumn: string | null;
  cashColumn: string | null;
  bankColumn: string | null;
  moneyJsonColumn: string | null;
  bannedColumn: string | null;
  whitelistedColumn: string | null;
  updatedAtColumn: string | null;
  searchColumns: string[];
};

type VehicleTableCapabilities = {
  tableName: string;
  keyColumn: string;
  ownerColumn: string | null;
  plateColumn: string | null;
  modelColumn: string | null;
  garageColumn: string | null;
  storedColumn: string | null;
  stateColumn: string | null;
  impoundedColumn: string | null;
  vehicleJsonColumn: string | null;
  updatedAtColumn: string | null;
  searchColumns: string[];
};

export type StaffPlayer = {
  identifier: string;
  displayName: string;
  charInfo: string | null;
  fullRow: Record<string, unknown>;
  job: string | null;
  jobLabel: string | null;
  cash: number | null;
  bank: number | null;
  banned: boolean | null;
  whitelisted: boolean | null;
};

export type StaffVehicle = {
  key: string;
  ownerIdentifier: string | null;
  plate: string | null;
  model: string | null;
  garage: string | null;
  stored: boolean | null;
  impounded: boolean | null;
  state: string | null;
};

export type StaffEconomyStats = {
  tableName: string;
  rowsAnalyzed: number;
  totalCash: number | null;
  totalBank: number | null;
  totalKnownMoney: number | null;
  accountTotals: Record<string, number>;
};

export type LabeledValue = {
  label: string;
  value: string;
};

export type StaffSkill = {
  name: string;
  level: number | null;
  statLevel: number | null;
  xp: number | null;
};

export type StaffGroup = {
  group: string;
  type: string;
  grade: number | null;
};

export type StaffBan = {
  reason: string | null;
  bannedBy: string | null;
  expireLabel: string | null;
  active: boolean;
};

export type StaffCriminalRecord = {
  mugshot: string | null;
  hasWarrant: boolean;
  notes: string | null;
};

export type StaffPlayerDetail = {
  identifier: string;
  displayName: string;
  license: string | null;
  banned: boolean | null;
  whitelisted: boolean | null;
  isDead: boolean | null;
  hasWarrant: boolean;
  jobLabel: string | null;
  gangLabel: string | null;
  identity: LabeledValue[];
  job: LabeledValue[];
  gang: LabeledValue[];
  money: LabeledValue[];
  character: LabeledValue[];
  vehicles: StaffVehicle[];
  skills: StaffSkill[];
  groups: StaffGroup[];
  criminal: StaffCriminalRecord | null;
  bans: StaffBan[];
  raw: Record<string, unknown>;
  supportsBanToggle: boolean;
  supportsWhitelistToggle: boolean;
};

export type StaffToolsSnapshot = {
  configured: boolean;
  connectionError: string | null;
  playerCapabilities: PlayerTableCapabilities | null;
  vehicleCapabilities: VehicleTableCapabilities | null;
  economy: StaffEconomyStats | null;
  players: StaffPlayer[];
  selectedPlayer: StaffPlayer | null;
  selectedPlayerVehicles: StaffVehicle[];
  vehicles: StaffVehicle[];
  stats: {
    totalPlayers: number | null;
    totalVehicles: number | null;
    bannedPlayers: number | null;
  };
};

type FiveMDbConfig = {
  uri?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
};

declare global {
  var fivemDbPool: Pool | undefined;
  var fivemSchemaPromise: Promise<SchemaSnapshot> | undefined;
}

const PLAYER_TABLE_NAMES = ["players", "users", "characters", "character_data"];
const PLAYER_ID_COLUMNS = ["citizenid", "identifier", "license", "steam", "id"];
const PLAYER_DISPLAY_NAME_COLUMNS = ["name", "player_name", "charname", "username"];
const PLAYER_FIRST_NAME_COLUMNS = ["firstname", "first_name"];
const PLAYER_LAST_NAME_COLUMNS = ["lastname", "last_name"];
const PLAYER_PROFILE_JSON_COLUMNS = ["charinfo", "identity", "profile", "metadata"];
const PLAYER_JOB_COLUMNS = ["job", "job_name", "group"];
const PLAYER_CASH_COLUMNS = ["cash", "money"];
const PLAYER_BANK_COLUMNS = ["bank", "bank_balance"];
const PLAYER_MONEY_JSON_COLUMNS = ["accounts", "money"];
const PLAYER_BANNED_COLUMNS = ["banned", "is_banned", "ban"];
const PLAYER_WHITELIST_COLUMNS = ["whitelisted", "whitelist", "is_whitelisted"];

const VEHICLE_TABLE_NAMES = [
  "player_vehicles",
  "owned_vehicles",
  "vehicles",
  "character_vehicles",
];
const VEHICLE_KEY_COLUMNS = ["plate", "id", "vehicleid"];
const VEHICLE_OWNER_COLUMNS = ["citizenid", "owner", "identifier", "license"];
const VEHICLE_PLATE_COLUMNS = ["plate", "plate_number", "plate_text"];
const VEHICLE_MODEL_COLUMNS = ["vehicle", "model", "vehicle_model", "hash"];
const VEHICLE_GARAGE_COLUMNS = ["garage", "parking", "garage_id"];
const VEHICLE_STORED_COLUMNS = ["stored", "in_garage"];
const VEHICLE_STATE_COLUMNS = ["state", "vehicle_state"];
const VEHICLE_IMPOUNDED_COLUMNS = ["impounded", "is_impounded"];
const VEHICLE_JSON_COLUMNS = ["vehicle", "mods", "props"];

const UPDATED_AT_COLUMNS = ["updated_at", "last_updated", "last_seen", "last_active", "id"];

function getFiveMDbConfig(): FiveMDbConfig | null {
  const uri = process.env.FIVEM_DB_URL?.trim();
  if (uri) return { uri };

  const host = process.env.FIVEM_DB_HOST?.trim();
  const portRaw = process.env.FIVEM_DB_PORT?.trim();
  const user = process.env.FIVEM_DB_USER?.trim();
  const password = process.env.FIVEM_DB_PASSWORD;
  const database = process.env.FIVEM_DB_NAME?.trim();

  if (!host || !user || !database) return null;

  const port = portRaw ? Number.parseInt(portRaw, 10) : 3306;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("FIVEM_DB_PORT must be a valid positive number.");
  }

  return {
    host,
    port,
    user,
    password,
    database,
  };
}

export function hasFiveMDbConfig(): boolean {
  try {
    return !!getFiveMDbConfig();
  } catch {
    // If parsing fails (for example invalid port), treat as configured so
    // the page can show a connection/config error instead of hiding tools.
    return true;
  }
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function getPool(): Pool {
  if (globalThis.fivemDbPool) return globalThis.fivemDbPool;

  const config = getFiveMDbConfig();
  if (!config) {
    throw new Error("FiveM database is not configured. Set FIVEM_DB_URL or split FIVEM_DB_* variables.");
  }

  const pool = config.uri
    ? mysql.createPool({
        uri: config.uri,
        waitForConnections: true,
        connectionLimit: 8,
        queueLimit: 0,
        decimalNumbers: true,
      })
    : mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 8,
        queueLimit: 0,
        decimalNumbers: true,
      });

  globalThis.fivemDbPool = pool;
  return pool;
}

async function queryRows<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(sql, params);
  return result;
}

function pickFirst(columnSet: Set<string>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (columnSet.has(candidate)) return candidate;
  }
  return null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeValueForDisplay(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `0x${value.toString("hex")}`;
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValueForDisplay(entry));
  }
  if (typeof value === "object") {
    const asObject = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(asObject).map(([key, entry]) => [key, normalizeValueForDisplay(entry)])
    );
  }
  return String(value);
}

function normalizeRowForDisplay(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValueForDisplay(value)])
  );
}

function addAccountTotal(
  totals: Map<string, number>,
  accountNameRaw: string | null | undefined,
  amountRaw: unknown
) {
  const accountName = normalizeText(accountNameRaw)?.toLowerCase();
  const amount = toNumber(amountRaw);
  if (!accountName || amount == null) return;
  totals.set(accountName, (totals.get(accountName) ?? 0) + amount);
}

function extractAccountTotals(value: unknown): Map<string, number> {
  const parsed = typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return null;
        }
      })()
    : value;

  const totals = new Map<string, number>();
  if (!parsed || typeof parsed !== "object") return totals;

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      addAccountTotal(
        totals,
        normalizeText(row.name) ||
          normalizeText(row.account) ||
          normalizeText(row.type) ||
          normalizeText(row.label),
        row.money ?? row.balance ?? row.amount ?? row.value
      );
    }
    return totals;
  }

  for (const [account, amount] of Object.entries(parsed as Record<string, unknown>)) {
    addAccountTotal(totals, account, amount);
  }

  return totals;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Recursively parse JSON that may be stored as a string (sometimes double
// encoded) inside longtext/text columns so the UI never has to render raw blobs.
function deepParseJson(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const looksJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"));
    if (looksJson) {
      try {
        return deepParseJson(JSON.parse(trimmed));
      } catch {
        return value;
      }
    }
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `0x${value.toString("hex")}`;
  if (Array.isArray(value)) return value.map((entry) => deepParseJson(entry));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        deepParseJson(entry),
      ])
    );
  }
  return value;
}

function asObject(value: unknown): Record<string, unknown> | null {
  const parsed = deepParseJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

// Derive a readable job/gang label like "EMS · Chief of Medicine" from a QBCore
// job blob ({ label, name, grade: { name } }).
function jobLabel(value: unknown): string | null {
  const parsed = asObject(value);
  if (!parsed) return normalizeText(value);
  const label = normalizeText(parsed.label) || normalizeText(parsed.name);
  const grade = asObject(parsed.grade);
  const gradeName = grade ? normalizeText(grade.name) : null;
  if (label && gradeName && label.toLowerCase() !== gradeName.toLowerCase()) {
    return `${label} · ${gradeName}`;
  }
  return label || gradeName || null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (!lowered) return null;
    if (["1", "true", "yes", "y", "on", "stored", "garage", "in"].includes(lowered)) return true;
    if (["0", "false", "no", "n", "off", "out", "outside"].includes(lowered)) return false;
  }
  return null;
}

function coerceBooleanForDatabase(existing: unknown, next: boolean): string | number | boolean {
  if (typeof existing === "boolean") return next;
  if (typeof existing === "number") return next ? 1 : 0;
  if (typeof existing === "string") {
    const lowered = existing.trim().toLowerCase();
    if (["true", "false"].includes(lowered)) return next ? "true" : "false";
    if (["yes", "no"].includes(lowered)) return next ? "yes" : "no";
    if (["stored", "out", "outside"].includes(lowered)) return next ? "stored" : "out";
    return next ? "1" : "0";
  }
  return next ? 1 : 0;
}

async function getSchemaSnapshot(forceRefresh = false): Promise<SchemaSnapshot> {
  if (!forceRefresh && globalThis.fivemSchemaPromise) {
    return globalThis.fivemSchemaPromise;
  }

  const snapshotPromise = (async () => {
    const columns = await queryRows<ColumnInfo & RowDataPacket>(
      `
        SELECT table_name AS tableName, column_name AS columnName
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        ORDER BY table_name, ordinal_position
      `
    );

    const byName = new Map<string, string[]>();
    for (const column of columns) {
      const tableName = column.tableName.toLowerCase();
      const columnName = column.columnName.toLowerCase();
      const existing = byName.get(tableName);
      if (existing) existing.push(columnName);
      else byName.set(tableName, [columnName]);
    }

    const tables: TableSchema[] = Array.from(byName.entries()).map(([tableName, tableColumns]) => ({
      tableName,
      columns: tableColumns,
      columnSet: new Set(tableColumns),
    }));

    return {
      tables,
      byName: new Map(tables.map((table) => [table.tableName, table])),
    };
  })();

  globalThis.fivemSchemaPromise = snapshotPromise;
  return snapshotPromise;
}

export async function refreshFiveMSchemaCache(): Promise<void> {
  globalThis.fivemSchemaPromise = undefined;
  await getSchemaSnapshot(true);
}

function detectPlayerCapabilities(schema: SchemaSnapshot): PlayerTableCapabilities | null {
  let best: { score: number; table: TableSchema } | null = null;

  for (const table of schema.tables) {
    const idColumn = pickFirst(table.columnSet, PLAYER_ID_COLUMNS);
    if (!idColumn) continue;

    let score = 0;
    if (PLAYER_TABLE_NAMES.includes(table.tableName)) score += 6;
    if (table.tableName.includes("player") || table.tableName.includes("user")) score += 2;
    if (pickFirst(table.columnSet, PLAYER_DISPLAY_NAME_COLUMNS)) score += 2;
    if (pickFirst(table.columnSet, PLAYER_PROFILE_JSON_COLUMNS)) score += 1.5;
    if (pickFirst(table.columnSet, PLAYER_CASH_COLUMNS) || pickFirst(table.columnSet, PLAYER_MONEY_JSON_COLUMNS)) {
      score += 1;
    }
    if (pickFirst(table.columnSet, PLAYER_BANNED_COLUMNS) || pickFirst(table.columnSet, PLAYER_WHITELIST_COLUMNS)) {
      score += 1;
    }

    if (!best || score > best.score) {
      best = { score, table };
    }
  }

  if (!best || best.score <= 0) return null;

  const table = best.table;
  const idColumn = pickFirst(table.columnSet, PLAYER_ID_COLUMNS);
  if (!idColumn) return null;

  const displayNameColumn = pickFirst(table.columnSet, PLAYER_DISPLAY_NAME_COLUMNS);
  const firstNameColumn = pickFirst(table.columnSet, PLAYER_FIRST_NAME_COLUMNS);
  const lastNameColumn = pickFirst(table.columnSet, PLAYER_LAST_NAME_COLUMNS);
  const profileJsonColumn = pickFirst(table.columnSet, PLAYER_PROFILE_JSON_COLUMNS);
  const jobColumn = pickFirst(table.columnSet, PLAYER_JOB_COLUMNS);
  const cashColumn = pickFirst(table.columnSet, PLAYER_CASH_COLUMNS);
  const bankColumn = pickFirst(table.columnSet, PLAYER_BANK_COLUMNS);
  const moneyJsonColumn = pickFirst(table.columnSet, PLAYER_MONEY_JSON_COLUMNS);
  const bannedColumn = pickFirst(table.columnSet, PLAYER_BANNED_COLUMNS);
  const whitelistedColumn = pickFirst(table.columnSet, PLAYER_WHITELIST_COLUMNS);
  const updatedAtColumn = pickFirst(table.columnSet, UPDATED_AT_COLUMNS);

  const searchColumns = unique([idColumn, displayNameColumn, firstNameColumn, lastNameColumn, jobColumn]);

  return {
    tableName: table.tableName,
    idColumn,
    displayNameColumn,
    firstNameColumn,
    lastNameColumn,
    profileJsonColumn,
    jobColumn,
    cashColumn,
    bankColumn,
    moneyJsonColumn,
    bannedColumn,
    whitelistedColumn,
    updatedAtColumn,
    searchColumns,
  };
}

function detectVehicleCapabilities(schema: SchemaSnapshot): VehicleTableCapabilities | null {
  let best: { score: number; table: TableSchema } | null = null;

  for (const table of schema.tables) {
    const keyColumn = pickFirst(table.columnSet, VEHICLE_KEY_COLUMNS);
    if (!keyColumn) continue;

    let score = 0;
    if (VEHICLE_TABLE_NAMES.includes(table.tableName)) score += 6;
    if (table.tableName.includes("vehicle")) score += 2;
    if (pickFirst(table.columnSet, VEHICLE_OWNER_COLUMNS)) score += 2;
    if (pickFirst(table.columnSet, VEHICLE_PLATE_COLUMNS)) score += 1;
    if (pickFirst(table.columnSet, VEHICLE_MODEL_COLUMNS) || pickFirst(table.columnSet, VEHICLE_JSON_COLUMNS)) {
      score += 1;
    }

    if (!best || score > best.score) {
      best = { score, table };
    }
  }

  if (!best || best.score <= 0) return null;

  const table = best.table;
  const keyColumn = pickFirst(table.columnSet, VEHICLE_KEY_COLUMNS);
  if (!keyColumn) return null;

  const ownerColumn = pickFirst(table.columnSet, VEHICLE_OWNER_COLUMNS);
  const plateColumn = pickFirst(table.columnSet, VEHICLE_PLATE_COLUMNS);
  const modelColumn = pickFirst(table.columnSet, VEHICLE_MODEL_COLUMNS);
  const garageColumn = pickFirst(table.columnSet, VEHICLE_GARAGE_COLUMNS);
  const storedColumn = pickFirst(table.columnSet, VEHICLE_STORED_COLUMNS);
  const stateColumn = pickFirst(table.columnSet, VEHICLE_STATE_COLUMNS);
  const impoundedColumn = pickFirst(table.columnSet, VEHICLE_IMPOUNDED_COLUMNS);
  const vehicleJsonColumn = pickFirst(table.columnSet, VEHICLE_JSON_COLUMNS);
  const updatedAtColumn = pickFirst(table.columnSet, UPDATED_AT_COLUMNS);

  const searchColumns = unique([keyColumn, ownerColumn, plateColumn, modelColumn]);

  return {
    tableName: table.tableName,
    keyColumn,
    ownerColumn,
    plateColumn,
    modelColumn,
    garageColumn,
    storedColumn,
    stateColumn,
    impoundedColumn,
    vehicleJsonColumn,
    updatedAtColumn,
    searchColumns,
  };
}

function buildSelectColumns(columns: Array<string | null | undefined>): string[] {
  return unique(columns);
}

function buildSearchWhere(search: string, columns: string[]): { clause: string; params: string[] } {
  const trimmed = search.trim();
  if (!trimmed || columns.length === 0) return { clause: "", params: [] };

  const parts = columns.map((column) => `${quoteIdentifier(column)} LIKE ?`);
  const params = columns.map(() => `%${trimmed}%`);
  return { clause: `WHERE ${parts.join(" OR ")}`, params };
}

async function countRows(tableName: string, whereClause = "", params: unknown[] = []): Promise<number> {
  const sql = `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)} ${whereClause}`;
  const rows = await queryRows<RowDataPacket & { count: number }>(sql, params);
  return rows[0]?.count ?? 0;
}

function resolvePlayerDisplayName(
  row: Record<string, unknown>,
  capabilities: PlayerTableCapabilities
): string {
  const direct = capabilities.displayNameColumn
    ? normalizeText(row[capabilities.displayNameColumn])
    : null;
  if (direct) return direct;

  const firstName = capabilities.firstNameColumn
    ? normalizeText(row[capabilities.firstNameColumn])
    : null;
  const lastName = capabilities.lastNameColumn
    ? normalizeText(row[capabilities.lastNameColumn])
    : null;
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");

  if (capabilities.profileJsonColumn) {
    const profile = parseJsonObject(row[capabilities.profileJsonColumn]);
    if (profile) {
      const fromProfileName = normalizeText(profile.name);
      const profileFirst = normalizeText(profile.firstname);
      const profileLast = normalizeText(profile.lastname);
      if (fromProfileName) return fromProfileName;
      if (profileFirst || profileLast) return [profileFirst, profileLast].filter(Boolean).join(" ");
    }
  }

  return "Unknown player";
}

function resolvePlayerMoney(
  row: Record<string, unknown>,
  capabilities: PlayerTableCapabilities
): { cash: number | null; bank: number | null } {
  let cash = capabilities.cashColumn ? toNumber(row[capabilities.cashColumn]) : null;
  let bank = capabilities.bankColumn ? toNumber(row[capabilities.bankColumn]) : null;

  if ((cash == null || bank == null) && capabilities.moneyJsonColumn) {
    const parsed = parseJsonObject(row[capabilities.moneyJsonColumn]);
    if (parsed) {
      if (cash == null) cash = toNumber(parsed.cash);
      if (bank == null) bank = toNumber(parsed.bank);
    }
  }

  return { cash, bank };
}

function resolvePlayerCharInfo(
  row: Record<string, unknown>,
  capabilities: PlayerTableCapabilities
): string | null {
  if (!capabilities.profileJsonColumn) return null;
  const value = row[capabilities.profileJsonColumn];
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return JSON.stringify(normalizeValueForDisplay(value), null, 2);
}

function resolveVehicleModel(
  row: Record<string, unknown>,
  capabilities: VehicleTableCapabilities
): string | null {
  const direct = capabilities.modelColumn ? normalizeText(row[capabilities.modelColumn]) : null;
  if (direct && capabilities.modelColumn !== capabilities.vehicleJsonColumn) return direct;

  if (capabilities.vehicleJsonColumn) {
    const vehicleData = parseJsonObject(row[capabilities.vehicleJsonColumn]);
    if (vehicleData) {
      return (
        normalizeText(vehicleData.model) ||
        normalizeText(vehicleData.vehicle) ||
        normalizeText(vehicleData.name) ||
        direct
      );
    }
  }

  return direct;
}

function resolveVehicleStoredValue(
  row: Record<string, unknown>,
  capabilities: VehicleTableCapabilities
): boolean | null {
  if (capabilities.storedColumn) {
    return toBoolean(row[capabilities.storedColumn]);
  }

  if (!capabilities.stateColumn) return null;
  const raw = row[capabilities.stateColumn];
  if (typeof raw === "number") return raw >= 1;
  return toBoolean(raw);
}

function mapPlayerRow(row: Record<string, unknown>, capabilities: PlayerTableCapabilities): StaffPlayer {
  const identifier = normalizeText(row[capabilities.idColumn]) || "unknown";
  const displayName = resolvePlayerDisplayName(row, capabilities);
  const charInfo = resolvePlayerCharInfo(row, capabilities);
  const fullRow = normalizeRowForDisplay(row);
  const { cash, bank } = resolvePlayerMoney(row, capabilities);
  const job = capabilities.jobColumn ? normalizeText(row[capabilities.jobColumn]) : null;
  const jobLabelValue = capabilities.jobColumn ? jobLabel(row[capabilities.jobColumn]) : null;
  const banned = capabilities.bannedColumn ? toBoolean(row[capabilities.bannedColumn]) : null;
  const whitelisted = capabilities.whitelistedColumn
    ? toBoolean(row[capabilities.whitelistedColumn])
    : null;

  return {
    identifier,
    displayName,
    charInfo,
    fullRow,
    job,
    jobLabel: jobLabelValue,
    cash,
    bank,
    banned,
    whitelisted,
  };
}

function mapVehicleRow(row: Record<string, unknown>, capabilities: VehicleTableCapabilities): StaffVehicle {
  const key = normalizeText(row[capabilities.keyColumn]) || "unknown";
  const ownerIdentifier = capabilities.ownerColumn
    ? normalizeText(row[capabilities.ownerColumn])
    : null;
  const plate = capabilities.plateColumn ? normalizeText(row[capabilities.plateColumn]) : null;
  const model = resolveVehicleModel(row, capabilities);
  const garage = capabilities.garageColumn ? normalizeText(row[capabilities.garageColumn]) : null;
  const stored = resolveVehicleStoredValue(row, capabilities);
  const impounded = capabilities.impoundedColumn
    ? toBoolean(row[capabilities.impoundedColumn])
    : null;
  const state = capabilities.stateColumn ? normalizeText(row[capabilities.stateColumn]) : null;

  return {
    key,
    ownerIdentifier,
    plate,
    model,
    garage,
    stored,
    impounded,
    state,
  };
}

async function fetchPlayers(
  capabilities: PlayerTableCapabilities,
  search: string,
  limit: number
): Promise<StaffPlayer[]> {
  const { clause, params } = buildSearchWhere(search, capabilities.searchColumns);
  const orderByColumn = capabilities.updatedAtColumn || capabilities.idColumn;

  const sql = `
    SELECT *
    FROM ${quoteIdentifier(capabilities.tableName)}
    ${clause}
    ORDER BY ${quoteIdentifier(orderByColumn)} DESC
    LIMIT ?
  `;

  const rows = await queryRows<RowDataPacket>(sql, [...params, limit]);
  return rows.map((row) => mapPlayerRow(row as Record<string, unknown>, capabilities));
}

async function fetchPlayerByIdentifier(
  capabilities: PlayerTableCapabilities,
  identifier: string
): Promise<StaffPlayer | null> {
  const sql = `
    SELECT *
    FROM ${quoteIdentifier(capabilities.tableName)}
    WHERE ${quoteIdentifier(capabilities.idColumn)} = ?
    LIMIT 1
  `;

  const rows = await queryRows<RowDataPacket>(sql, [identifier]);
  const row = rows[0];
  return row ? mapPlayerRow(row as Record<string, unknown>, capabilities) : null;
}

async function fetchVehicles(
  capabilities: VehicleTableCapabilities,
  search: string,
  limit: number
): Promise<StaffVehicle[]> {
  const selectedColumns = buildSelectColumns([
    capabilities.keyColumn,
    capabilities.ownerColumn,
    capabilities.plateColumn,
    capabilities.modelColumn,
    capabilities.garageColumn,
    capabilities.storedColumn,
    capabilities.stateColumn,
    capabilities.impoundedColumn,
    capabilities.vehicleJsonColumn,
    capabilities.updatedAtColumn,
  ]);

  const sqlColumns = selectedColumns.map((column) => quoteIdentifier(column)).join(", ");
  const { clause, params } = buildSearchWhere(search, capabilities.searchColumns);
  const orderByColumn = capabilities.updatedAtColumn || capabilities.keyColumn;

  const sql = `
    SELECT ${sqlColumns}
    FROM ${quoteIdentifier(capabilities.tableName)}
    ${clause}
    ORDER BY ${quoteIdentifier(orderByColumn)} DESC
    LIMIT ?
  `;

  const rows = await queryRows<RowDataPacket>(sql, [...params, limit]);
  return rows.map((row) => mapVehicleRow(row as Record<string, unknown>, capabilities));
}

async function fetchVehiclesByOwner(
  capabilities: VehicleTableCapabilities,
  ownerIdentifier: string,
  limit: number
): Promise<StaffVehicle[]> {
  if (!capabilities.ownerColumn) return [];

  const selectedColumns = buildSelectColumns([
    capabilities.keyColumn,
    capabilities.ownerColumn,
    capabilities.plateColumn,
    capabilities.modelColumn,
    capabilities.garageColumn,
    capabilities.storedColumn,
    capabilities.stateColumn,
    capabilities.impoundedColumn,
    capabilities.vehicleJsonColumn,
    capabilities.updatedAtColumn,
  ]);

  const sqlColumns = selectedColumns.map((column) => quoteIdentifier(column)).join(", ");
  const orderByColumn = capabilities.updatedAtColumn || capabilities.keyColumn;

  const sql = `
    SELECT ${sqlColumns}
    FROM ${quoteIdentifier(capabilities.tableName)}
    WHERE ${quoteIdentifier(capabilities.ownerColumn)} = ?
    ORDER BY ${quoteIdentifier(orderByColumn)} DESC
    LIMIT ?
  `;

  const rows = await queryRows<RowDataPacket>(sql, [ownerIdentifier, limit]);
  return rows.map((row) => mapVehicleRow(row as Record<string, unknown>, capabilities));
}

function sumByAliases(
  accountTotals: Map<string, number>,
  aliases: string[]
): number | null {
  let total = 0;
  let found = false;
  for (const alias of aliases) {
    const value = accountTotals.get(alias);
    if (value == null) continue;
    total += value;
    found = true;
  }
  return found ? total : null;
}

function mapToRecord(values: Map<string, number>): Record<string, number> {
  return Object.fromEntries(Array.from(values.entries()).sort((a, b) => b[1] - a[1]));
}

async function fetchEconomyStats(
  capabilities: PlayerTableCapabilities
): Promise<StaffEconomyStats> {
  const columns = buildSelectColumns([
    capabilities.cashColumn,
    capabilities.bankColumn,
    capabilities.moneyJsonColumn,
  ]);
  if (columns.length === 0) {
    return {
      tableName: capabilities.tableName,
      rowsAnalyzed: 0,
      totalCash: null,
      totalBank: null,
      totalKnownMoney: null,
      accountTotals: {},
    };
  }

  const sqlColumns = columns.map((column) => quoteIdentifier(column)).join(", ");
  const sql = `
    SELECT ${sqlColumns}
    FROM ${quoteIdentifier(capabilities.tableName)}
  `;
  const rows = await queryRows<RowDataPacket>(sql);

  let explicitCashTotal = 0;
  let explicitBankTotal = 0;
  let hasExplicitCash = false;
  let hasExplicitBank = false;
  const accountTotals = new Map<string, number>();

  for (const row of rows) {
    const plain = row as Record<string, unknown>;

    if (capabilities.cashColumn) {
      const value = toNumber(plain[capabilities.cashColumn]);
      if (value != null) {
        explicitCashTotal += value;
        hasExplicitCash = true;
      }
    }

    if (capabilities.bankColumn) {
      const value = toNumber(plain[capabilities.bankColumn]);
      if (value != null) {
        explicitBankTotal += value;
        hasExplicitBank = true;
      }
    }

    if (capabilities.moneyJsonColumn) {
      const rowTotals = extractAccountTotals(plain[capabilities.moneyJsonColumn]);
      for (const [account, amount] of rowTotals.entries()) {
        accountTotals.set(account, (accountTotals.get(account) ?? 0) + amount);
      }
    }
  }

  const jsonCashTotal = sumByAliases(accountTotals, ["cash", "money", "wallet"]);
  const jsonBankTotal = sumByAliases(accountTotals, ["bank", "bank_balance"]);
  const totalCash = hasExplicitCash ? explicitCashTotal : jsonCashTotal;
  const totalBank = hasExplicitBank ? explicitBankTotal : jsonBankTotal;

  // Avoid double-counting aliases that map into the cash/bank top-level cards.
  const otherAccounts = new Map(accountTotals);
  for (const key of ["cash", "money", "wallet", "bank", "bank_balance"]) {
    otherAccounts.delete(key);
  }

  const otherTotal = Array.from(otherAccounts.values()).reduce((sum, value) => sum + value, 0);
  const totalKnownMoney =
    totalCash == null && totalBank == null && otherAccounts.size === 0
      ? null
      : (totalCash ?? 0) + (totalBank ?? 0) + otherTotal;

  return {
    tableName: capabilities.tableName,
    rowsAnalyzed: rows.length,
    totalCash,
    totalBank,
    totalKnownMoney,
    accountTotals: mapToRecord(otherAccounts),
  };
}

async function fetchCurrentFieldValue(
  tableName: string,
  idColumn: string,
  idValue: string,
  fieldColumn: string
): Promise<unknown> {
  const sql = `
    SELECT ${quoteIdentifier(fieldColumn)} AS currentValue
    FROM ${quoteIdentifier(tableName)}
    WHERE ${quoteIdentifier(idColumn)} = ?
    LIMIT 1
  `;
  const rows = await queryRows<RowDataPacket & { currentValue: unknown }>(sql, [idValue]);
  if (!rows[0]) {
    throw new Error("Target record was not found.");
  }
  return rows[0].currentValue;
}

export async function getStaffToolsSnapshot(input?: {
  playerSearch?: string;
  vehicleSearch?: string;
  selectedPlayerIdentifier?: string;
  limit?: number;
  includeEconomy?: boolean;
}): Promise<StaffToolsSnapshot> {
  const configured = hasFiveMDbConfig();
  if (!configured) {
    return {
      configured: false,
      connectionError: null,
      playerCapabilities: null,
      vehicleCapabilities: null,
      economy: null,
      players: [],
      selectedPlayer: null,
      selectedPlayerVehicles: [],
      vehicles: [],
      stats: { totalPlayers: null, totalVehicles: null, bannedPlayers: null },
    };
  }

  try {
    const limit = Math.max(1, Math.min(input?.limit ?? 75, 200));
    const includeEconomy = input?.includeEconomy === true;
    const schema = await getSchemaSnapshot();
    const playerCapabilities = detectPlayerCapabilities(schema);
    const vehicleCapabilities = detectVehicleCapabilities(schema);
    const selectedPlayerIdentifier = input?.selectedPlayerIdentifier?.trim();

    const [
      players,
      vehicles,
      selectedPlayer,
      selectedPlayerVehicles,
      economy,
      totalPlayers,
      totalVehicles,
      bannedPlayers,
    ] = await Promise.all([
      playerCapabilities ? fetchPlayers(playerCapabilities, input?.playerSearch || "", limit) : Promise.resolve([]),
      vehicleCapabilities ? fetchVehicles(vehicleCapabilities, input?.vehicleSearch || "", limit) : Promise.resolve([]),
      playerCapabilities && selectedPlayerIdentifier
        ? fetchPlayerByIdentifier(playerCapabilities, selectedPlayerIdentifier)
        : Promise.resolve(null),
      vehicleCapabilities?.ownerColumn && selectedPlayerIdentifier
        ? fetchVehiclesByOwner(vehicleCapabilities, selectedPlayerIdentifier, 25)
        : Promise.resolve([]),
      includeEconomy && playerCapabilities ? fetchEconomyStats(playerCapabilities) : Promise.resolve(null),
      playerCapabilities ? countRows(playerCapabilities.tableName) : Promise.resolve(null),
      vehicleCapabilities ? countRows(vehicleCapabilities.tableName) : Promise.resolve(null),
      playerCapabilities?.bannedColumn
        ? countRows(
            playerCapabilities.tableName,
            `WHERE ${quoteIdentifier(playerCapabilities.bannedColumn)} IN (1, '1', true, 'true', 'yes')`
          )
        : Promise.resolve(null),
    ]);

    return {
      configured: true,
      connectionError: null,
      playerCapabilities,
      vehicleCapabilities,
      economy,
      players,
      selectedPlayer,
      selectedPlayerVehicles,
      vehicles,
      stats: {
        totalPlayers,
        totalVehicles,
        bannedPlayers,
      },
    };
  } catch (error) {
    return {
      configured: true,
      connectionError: error instanceof Error ? error.message : "Unable to query FiveM database.",
      playerCapabilities: null,
      vehicleCapabilities: null,
      economy: null,
      players: [],
      selectedPlayer: null,
      selectedPlayerVehicles: [],
      vehicles: [],
      stats: { totalPlayers: null, totalVehicles: null, bannedPlayers: null },
    };
  }
}

function findTable(schema: SchemaSnapshot, names: string[]): TableSchema | null {
  for (const name of names) {
    const table = schema.byName.get(name.toLowerCase());
    if (table) return table;
  }
  return null;
}

// Row keys keep their original database casing (e.g. `hasWarrant`, `citizenID`),
// so look up fields case-insensitively.
function getField(row: Record<string, unknown>, name: string): unknown {
  if (name in row) return row[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lower) return row[key];
  }
  return undefined;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatScalar(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (value instanceof Date) return value.toLocaleString();
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function pushLabeled(out: LabeledValue[], label: string, value: unknown) {
  const text = formatScalar(value);
  if (text != null) out.push({ label, value: text });
}

function formatCurrency(value: unknown): string | null {
  const num = toNumber(value);
  if (num == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatGender(value: unknown): string | null {
  const num = toNumber(value);
  if (num === 0) return "Male";
  if (num === 1) return "Female";
  return normalizeText(value);
}

function buildIdentity(charinfo: Record<string, unknown> | null): LabeledValue[] {
  const out: LabeledValue[] = [];
  if (!charinfo) return out;
  pushLabeled(out, "First name", charinfo.firstname);
  pushLabeled(out, "Last name", charinfo.lastname);
  pushLabeled(out, "Gender", formatGender(charinfo.gender));
  pushLabeled(out, "Date of birth", charinfo.birthdate);
  pushLabeled(out, "Nationality", charinfo.nationality);
  const height = toNumber(charinfo.height);
  if (height != null) out.push({ label: "Height", value: `${Math.round(height)} cm` });
  pushLabeled(out, "Phone", charinfo.phone);
  pushLabeled(out, "Bank account", charinfo.account);
  pushLabeled(out, "Backstory", charinfo.backstory);
  return out;
}

function buildJobDetails(job: Record<string, unknown> | null): LabeledValue[] {
  const out: LabeledValue[] = [];
  if (!job) return out;
  pushLabeled(out, "Name", normalizeText(job.label) || normalizeText(job.name));
  const grade = asObject(job.grade);
  if (grade) {
    pushLabeled(out, "Rank", normalizeText(grade.name));
    pushLabeled(out, "Grade", grade.level);
  }
  if (typeof job.onduty === "boolean") out.push({ label: "On duty", value: job.onduty ? "Yes" : "No" });
  if (typeof job.isboss === "boolean") out.push({ label: "Boss", value: job.isboss ? "Yes" : "No" });
  pushLabeled(out, "Paycheck", formatCurrency(job.payment));
  return out;
}

const KNOWN_MONEY_ACCOUNTS = ["cash", "bank", "crypto", "rene"];

function buildMoney(money: Record<string, unknown> | null): LabeledValue[] {
  const out: LabeledValue[] = [];
  if (!money) return out;
  pushLabeled(out, "Cash", formatCurrency(money.cash));
  pushLabeled(out, "Bank", formatCurrency(money.bank));
  if (money.crypto != null) pushLabeled(out, "Crypto", money.crypto);
  if (money.rene != null) pushLabeled(out, "Rene", money.rene);
  for (const [key, value] of Object.entries(money)) {
    if (KNOWN_MONEY_ACCOUNTS.includes(key.toLowerCase())) continue;
    pushLabeled(out, capitalize(key), formatCurrency(value) ?? value);
  }
  return out;
}

function buildCharacter(
  metadata: Record<string, unknown> | null,
  row: Record<string, unknown>
): LabeledValue[] {
  const out: LabeledValue[] = [];
  const meta = metadata || {};
  pushLabeled(out, "Blood type", meta.bloodtype ?? getField(row, "bloodtype"));
  pushLabeled(out, "Fingerprint", meta.fingerprint ?? getField(row, "fingerprint"));
  pushLabeled(out, "Callsign", meta.callsign);

  const licences = asObject(meta.licences);
  if (licences) {
    const enabled = Object.entries(licences)
      .filter(([, value]) => value === true)
      .map(([key]) => capitalize(key));
    if (enabled.length) out.push({ label: "Licenses", value: enabled.join(", ") });
  }

  const hunger = toNumber(meta.hunger);
  if (hunger != null) out.push({ label: "Hunger", value: `${Math.round(hunger)}%` });
  const thirst = toNumber(meta.thirst);
  if (thirst != null) out.push({ label: "Thirst", value: `${Math.round(thirst)}%` });
  const stress = toNumber(meta.stress);
  if (stress != null) out.push({ label: "Stress", value: `${Math.round(stress)}%` });

  pushLabeled(out, "Health", getField(row, "health"));
  pushLabeled(out, "Armor", getField(row, "armor"));
  pushLabeled(out, "Phone number", getField(row, "phone_number"));

  const jailTime = toNumber(getField(row, "jail_time"));
  if (jailTime != null && jailTime > 0) {
    out.push({ label: "Jail time", value: String(jailTime) });
    pushLabeled(out, "Jail type", getField(row, "jail_type"));
  }

  pushLabeled(out, "Last updated", getField(row, "last_updated"));
  pushLabeled(out, "Last logout", getField(row, "last_logged_out"));
  return out;
}

async function fetchPlayerRawRow(
  capabilities: PlayerTableCapabilities,
  identifier: string
): Promise<Record<string, unknown> | null> {
  const sql = `
    SELECT *
    FROM ${quoteIdentifier(capabilities.tableName)}
    WHERE ${quoteIdentifier(capabilities.idColumn)} = ?
    LIMIT 1
  `;
  const rows = await queryRows<RowDataPacket>(sql, [identifier]);
  return rows[0] ? (rows[0] as Record<string, unknown>) : null;
}

async function fetchPlayerSkills(table: TableSchema, identifier: string): Promise<StaffSkill[]> {
  const idColumn = pickFirst(table.columnSet, ["citizenid", "citizenID", "uniqueid", "id"]) || "citizenid";
  const sql = `
    SELECT *
    FROM ${quoteIdentifier(table.tableName)}
    WHERE ${quoteIdentifier(idColumn)} = ?
    LIMIT 1
  `;
  const rows = await queryRows<RowDataPacket>(sql, [identifier]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return [];

  const out: StaffSkill[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (key.toLowerCase() === idColumn.toLowerCase()) continue;
    const parsed = asObject(value);
    if (!parsed) continue;
    out.push({
      name: capitalize(key),
      level: toNumber(parsed.level),
      statLevel: toNumber(parsed.statlevel),
      xp: toNumber(parsed.xp),
    });
  }
  return out;
}

async function fetchPlayerGroups(table: TableSchema, identifier: string): Promise<StaffGroup[]> {
  const idColumn = pickFirst(table.columnSet, ["citizenid", "citizenID"]) || "citizenid";
  const sql = `
    SELECT *
    FROM ${quoteIdentifier(table.tableName)}
    WHERE ${quoteIdentifier(idColumn)} = ?
  `;
  const rows = await queryRows<RowDataPacket>(sql, [identifier]);
  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      group: normalizeText(getField(row, "group")) || "",
      type: normalizeText(getField(row, "type")) || "",
      grade: toNumber(getField(row, "grade")),
    };
  });
}

async function fetchCriminalRecord(
  table: TableSchema,
  identifier: string
): Promise<StaffCriminalRecord | null> {
  const idColumn = pickFirst(table.columnSet, ["uniqueid", "citizenid", "id"]) || "uniqueid";
  const sql = `
    SELECT *
    FROM ${quoteIdentifier(table.tableName)}
    WHERE ${quoteIdentifier(idColumn)} = ?
    LIMIT 1
  `;
  const rows = await queryRows<RowDataPacket>(sql, [identifier]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    mugshot: normalizeText(getField(row, "mugshot")),
    hasWarrant: toBoolean(getField(row, "hasWarrant")) ?? false,
    notes: normalizeText(getField(row, "notes")),
  };
}

function formatBanExpire(expire: number | null): { label: string; active: boolean } {
  if (expire == null || expire === 0) return { label: "Permanent", active: true };
  const ms = expire > 1e12 ? expire : expire * 1000;
  return { label: new Date(ms).toLocaleString(), active: ms > Date.now() };
}

async function fetchPlayerBans(table: TableSchema, license: string | null): Promise<StaffBan[]> {
  if (!license) return [];
  const licenseColumn = pickFirst(table.columnSet, ["license"]);
  if (!licenseColumn) return [];

  const sql = `
    SELECT *
    FROM ${quoteIdentifier(table.tableName)}
    WHERE ${quoteIdentifier(licenseColumn)} = ?
  `;
  const rows = await queryRows<RowDataPacket>(sql, [license]);
  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const { label, active } = formatBanExpire(toNumber(getField(row, "expire")));
    return {
      reason: normalizeText(getField(row, "reason")),
      bannedBy: normalizeText(getField(row, "bannedby")),
      expireLabel: label,
      active,
    };
  });
}

export async function getStaffPlayerDetail(identifier: string): Promise<StaffPlayerDetail | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (!hasFiveMDbConfig()) return null;

  const schema = await getSchemaSnapshot();
  const playerCaps = detectPlayerCapabilities(schema);
  if (!playerCaps) return null;

  const row = await fetchPlayerRawRow(playerCaps, trimmed);
  if (!row) return null;

  const vehicleCaps = detectVehicleCapabilities(schema);
  const skillsTable = findTable(schema, ["player_skills"]);
  const groupsTable = findTable(schema, ["player_groups"]);
  const criminalTable = findTable(schema, ["mdt_criminals"]);
  const bansTable = findTable(schema, ["bans"]);

  const license = normalizeText(getField(row, "license"));

  const charinfo = asObject(getField(row, playerCaps.profileJsonColumn || "charinfo"));
  const job = asObject(getField(row, playerCaps.jobColumn || "job"));
  const gang = asObject(getField(row, "gang"));
  const money = asObject(getField(row, playerCaps.moneyJsonColumn || "money"));
  const metadata = asObject(getField(row, "metadata"));

  const [vehicles, skills, groups, criminal, bans] = await Promise.all([
    vehicleCaps?.ownerColumn ? fetchVehiclesByOwner(vehicleCaps, trimmed, 50) : Promise.resolve([]),
    skillsTable ? fetchPlayerSkills(skillsTable, trimmed) : Promise.resolve([]),
    groupsTable ? fetchPlayerGroups(groupsTable, trimmed) : Promise.resolve([]),
    criminalTable ? fetchCriminalRecord(criminalTable, trimmed) : Promise.resolve(null),
    bansTable ? fetchPlayerBans(bansTable, license) : Promise.resolve([]),
  ]);

  let banned: boolean | null;
  if (playerCaps.bannedColumn) {
    banned = toBoolean(getField(row, playerCaps.bannedColumn));
  } else if (bansTable) {
    banned = bans.some((ban) => ban.active);
  } else {
    banned = null;
  }

  const whitelisted = playerCaps.whitelistedColumn
    ? toBoolean(getField(row, playerCaps.whitelistedColumn))
    : null;

  return {
    identifier: normalizeText(getField(row, playerCaps.idColumn)) || trimmed,
    displayName: resolvePlayerDisplayName(row, playerCaps),
    license,
    banned,
    whitelisted,
    isDead: toBoolean(getField(row, "isdead")),
    hasWarrant: criminal?.hasWarrant ?? false,
    jobLabel: jobLabel(job),
    gangLabel: jobLabel(gang),
    identity: buildIdentity(charinfo),
    job: buildJobDetails(job),
    gang: buildJobDetails(gang),
    money: buildMoney(money),
    character: buildCharacter(metadata, row),
    vehicles,
    skills,
    groups,
    criminal,
    bans,
    raw: normalizeRowForDisplay(row),
    supportsBanToggle: !!playerCaps.bannedColumn,
    supportsWhitelistToggle: !!playerCaps.whitelistedColumn,
  };
}

export type MetricCount = { name: string; count: number };
export type WealthBucket = { bucket: string; count: number };
export type TopPlayer = { identifier: string; name: string; total: number };

export type DashboardMetrics = {
  configured: boolean;
  connectionError: string | null;
  generatedAt: string;
  players: {
    total: number;
    dead: number;
    jailed: number;
    activeLast7d: number;
    activeLast30d: number;
  };
  economy: {
    totalCash: number;
    totalBank: number;
    totalCrypto: number;
    total: number;
    distribution: WealthBucket[];
    topPlayers: TopPlayer[];
  };
  jobs: {
    byJob: MetricCount[];
    onDuty: number;
    offDuty: number;
    topGangs: MetricCount[];
  };
  vehicles: {
    total: number;
    byGarage: MetricCount[];
    topModels: MetricCount[];
    stored: number;
    outside: number;
    impounded: number;
    financed: number;
  };
};

function bumpCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topCounts(map: Map<string, number>, limit: number): MetricCount[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function emptyDashboardMetrics(configured: boolean): DashboardMetrics {
  return {
    configured,
    connectionError: null,
    generatedAt: new Date().toISOString(),
    players: { total: 0, dead: 0, jailed: 0, activeLast7d: 0, activeLast30d: 0 },
    economy: {
      totalCash: 0,
      totalBank: 0,
      totalCrypto: 0,
      total: 0,
      distribution: [],
      topPlayers: [],
    },
    jobs: { byJob: [], onDuty: 0, offDuty: 0, topGangs: [] },
    vehicles: {
      total: 0,
      byGarage: [],
      topModels: [],
      stored: 0,
      outside: 0,
      impounded: 0,
      financed: 0,
    },
  };
}

// Computes current-state aggregate metrics from the FiveM database for the
// analytics dashboard. Reductions run in JS so the logic stays robust across
// different QBCore/ESX-style schemas rather than relying on JSON SQL functions.
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const metrics = emptyDashboardMetrics(hasFiveMDbConfig());
  if (!metrics.configured) return metrics;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  try {
    const schema = await getSchemaSnapshot();
    const playerCaps = detectPlayerCapabilities(schema);
    const vehicleCaps = detectVehicleCapabilities(schema);

    if (playerCaps) {
      const rows = await queryRows<RowDataPacket>(
        `SELECT * FROM ${quoteIdentifier(playerCaps.tableName)} LIMIT 10000`
      );
      metrics.players.total = rows.length;

      const jobMap = new Map<string, number>();
      const gangMap = new Map<string, number>();
      const wealth = [0, 0, 0, 0, 0];
      const topList: TopPlayer[] = [];

      for (const raw of rows) {
        const row = raw as Record<string, unknown>;

        const money = asObject(getField(row, playerCaps.moneyJsonColumn || "money"));
        const cash =
          toNumber(money?.cash) ??
          (playerCaps.cashColumn ? toNumber(getField(row, playerCaps.cashColumn)) : null) ??
          0;
        const bank =
          toNumber(money?.bank) ??
          (playerCaps.bankColumn ? toNumber(getField(row, playerCaps.bankColumn)) : null) ??
          0;
        const crypto = toNumber(money?.crypto) ?? 0;
        metrics.economy.totalCash += cash;
        metrics.economy.totalBank += bank;
        metrics.economy.totalCrypto += crypto;

        const total = cash + bank;
        if (total < 10000) wealth[0]++;
        else if (total < 50000) wealth[1]++;
        else if (total < 250000) wealth[2]++;
        else if (total < 1000000) wealth[3]++;
        else wealth[4]++;

        topList.push({
          identifier: normalizeText(getField(row, playerCaps.idColumn)) || "?",
          name: resolvePlayerDisplayName(row, playerCaps),
          total,
        });

        const job = asObject(getField(row, playerCaps.jobColumn || "job"));
        const jobName = (job ? normalizeText(job.label) || normalizeText(job.name) : null) || "Unknown";
        bumpCount(jobMap, jobName);
        if (job && job.onduty === true) metrics.jobs.onDuty++;
        else metrics.jobs.offDuty++;

        const gang = asObject(getField(row, "gang"));
        if (gang) {
          const gangName = normalizeText(gang.label) || normalizeText(gang.name);
          const rawName = normalizeText(gang.name);
          if (gangName && (!rawName || rawName.toLowerCase() !== "none")) {
            bumpCount(gangMap, gangName);
          }
        }

        const metadata = asObject(getField(row, "metadata"));
        if (toBoolean(getField(row, "isdead")) === true || metadata?.isdead === true) {
          metrics.players.dead++;
        }
        const jailTime = toNumber(getField(row, "jail_time")) ?? toNumber(metadata?.injail);
        if (jailTime && jailTime > 0) metrics.players.jailed++;

        const updated = getField(row, playerCaps.updatedAtColumn || "last_updated");
        const ts =
          updated instanceof Date
            ? updated.getTime()
            : typeof updated === "string"
              ? Date.parse(updated)
              : NaN;
        if (Number.isFinite(ts)) {
          if (now - ts <= 7 * DAY) metrics.players.activeLast7d++;
          if (now - ts <= 30 * DAY) metrics.players.activeLast30d++;
        }
      }

      metrics.economy.total = metrics.economy.totalCash + metrics.economy.totalBank;
      metrics.economy.distribution = [
        { bucket: "< $10k", count: wealth[0] },
        { bucket: "$10k–50k", count: wealth[1] },
        { bucket: "$50k–250k", count: wealth[2] },
        { bucket: "$250k–1M", count: wealth[3] },
        { bucket: "$1M+", count: wealth[4] },
      ];
      metrics.economy.topPlayers = topList.sort((a, b) => b.total - a.total).slice(0, 8);
      metrics.jobs.byJob = topCounts(jobMap, 12);
      metrics.jobs.topGangs = topCounts(gangMap, 8);
    }

    if (vehicleCaps) {
      const rows = await queryRows<RowDataPacket>(
        `SELECT * FROM ${quoteIdentifier(vehicleCaps.tableName)} LIMIT 20000`
      );
      metrics.vehicles.total = rows.length;

      const garageMap = new Map<string, number>();
      const modelMap = new Map<string, number>();

      for (const raw of rows) {
        const row = raw as Record<string, unknown>;
        const garage =
          (vehicleCaps.garageColumn ? normalizeText(getField(row, vehicleCaps.garageColumn)) : null) ||
          normalizeText(getField(row, "garage")) ||
          normalizeText(getField(row, "garage_id")) ||
          "Unknown";
        bumpCount(garageMap, garage);

        const model = resolveVehicleModel(row, vehicleCaps) || "Unknown";
        bumpCount(modelMap, model);

        const stored = resolveVehicleStoredValue(row, vehicleCaps);
        if (stored === true) metrics.vehicles.stored++;
        else if (stored === false) metrics.vehicles.outside++;

        const impound = normalizeText(getField(row, "impound"));
        const impoundData = normalizeText(getField(row, "impound_data"));
        if ((impound && impound.toLowerCase() !== "no") || (impoundData && impoundData.length > 2)) {
          metrics.vehicles.impounded++;
        }
        if (toBoolean(getField(row, "financed")) === true) metrics.vehicles.financed++;
      }

      metrics.vehicles.byGarage = topCounts(garageMap, 12);
      metrics.vehicles.topModels = topCounts(modelMap, 12);
    }

    return metrics;
  } catch (error) {
    metrics.connectionError =
      error instanceof Error ? error.message : "Unable to query FiveM database.";
    return metrics;
  }
}

export async function togglePlayerFlag(
  identifier: string,
  flag: "banned" | "whitelisted"
): Promise<void> {
  const schema = await getSchemaSnapshot();
  const capabilities = detectPlayerCapabilities(schema);
  if (!capabilities) {
    throw new Error("Could not locate a player table in the FiveM database.");
  }

  const targetColumn = flag === "banned" ? capabilities.bannedColumn : capabilities.whitelistedColumn;
  if (!targetColumn) {
    throw new Error(`The detected player table does not include a "${flag}" field.`);
  }

  const currentValue = await fetchCurrentFieldValue(
    capabilities.tableName,
    capabilities.idColumn,
    identifier,
    targetColumn
  );
  const nextValue = !(toBoolean(currentValue) ?? false);
  const updateValue = coerceBooleanForDatabase(currentValue, nextValue);

  const sql = `
    UPDATE ${quoteIdentifier(capabilities.tableName)}
    SET ${quoteIdentifier(targetColumn)} = ?
    WHERE ${quoteIdentifier(capabilities.idColumn)} = ?
    LIMIT 1
  `;

  const result = await execute(sql, [updateValue, identifier]);
  if (result.affectedRows < 1) {
    throw new Error("No player row was updated.");
  }
}

export async function toggleVehicleStorageState(vehicleKey: string): Promise<void> {
  const schema = await getSchemaSnapshot();
  const capabilities = detectVehicleCapabilities(schema);
  if (!capabilities) {
    throw new Error("Could not locate a vehicle table in the FiveM database.");
  }

  const targetColumn = capabilities.storedColumn || capabilities.stateColumn;
  if (!targetColumn) {
    throw new Error("The detected vehicle table does not expose a stored/state column.");
  }

  const currentValue = await fetchCurrentFieldValue(
    capabilities.tableName,
    capabilities.keyColumn,
    vehicleKey,
    targetColumn
  );
  const currentBool = capabilities.storedColumn
    ? toBoolean(currentValue)
    : typeof currentValue === "number"
      ? currentValue >= 1
      : toBoolean(currentValue);
  const nextValue = !(currentBool ?? false);
  const updateValue = coerceBooleanForDatabase(currentValue, nextValue);

  const sql = `
    UPDATE ${quoteIdentifier(capabilities.tableName)}
    SET ${quoteIdentifier(targetColumn)} = ?
    WHERE ${quoteIdentifier(capabilities.keyColumn)} = ?
    LIMIT 1
  `;
  const result = await execute(sql, [updateValue, vehicleKey]);
  if (result.affectedRows < 1) {
    throw new Error("No vehicle row was updated.");
  }
}

export async function putVehicleInGarage(vehicleKey: string, garageName: string): Promise<void> {
  const garage = garageName.trim();
  if (!garage) {
    throw new Error("Garage name is required.");
  }
  if (garage.length > 100) {
    throw new Error("Garage name must be 100 characters or fewer.");
  }

  const schema = await getSchemaSnapshot();
  const capabilities = detectVehicleCapabilities(schema);
  if (!capabilities) {
    throw new Error("Could not locate a vehicle table in the FiveM database.");
  }

  if (!capabilities.garageColumn) {
    throw new Error("The detected vehicle table does not expose a garage column.");
  }

  const storageColumn = capabilities.storedColumn || capabilities.stateColumn;
  if (!storageColumn) {
    throw new Error("The detected vehicle table does not expose a stored/state column.");
  }

  const currentStorageValue = await fetchCurrentFieldValue(
    capabilities.tableName,
    capabilities.keyColumn,
    vehicleKey,
    storageColumn
  );
  const storedValue = coerceBooleanForDatabase(currentStorageValue, true);

  const sql = `
    UPDATE ${quoteIdentifier(capabilities.tableName)}
    SET ${quoteIdentifier(capabilities.garageColumn)} = ?,
        ${quoteIdentifier(storageColumn)} = ?
    WHERE ${quoteIdentifier(capabilities.keyColumn)} = ?
    LIMIT 1
  `;
  const result = await execute(sql, [garage, storedValue, vehicleKey]);
  if (result.affectedRows < 1) {
    throw new Error("No vehicle row was updated.");
  }
}
