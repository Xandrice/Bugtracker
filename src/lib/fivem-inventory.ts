import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import {
  getFiveMSchemaTable,
  hasFiveMDbConfig,
  queryFiveMRows,
  quoteFiveMIdentifier,
} from "@/lib/fivem-db";
import {
  collectContainerIds,
  parseInventoryItems,
  playerInventoryNames,
  type StaffInventoryItem,
  vehicleInventoryNames,
} from "@/lib/fivem-inventory-parse";

export {
  INVENTORY_ITEM_CAP,
  coerceInventoryArray,
  collectContainerIds,
  mapInventoryItem,
  parseInventoryItems,
  playerInventoryNames,
  vehicleInventoryNames,
} from "@/lib/fivem-inventory-parse";
export type { StaffInventoryItem } from "@/lib/fivem-inventory-parse";

const MAX_VEHICLES = 50;
const MAX_STASH_ROWS = 80;

export type StaffInventoryContainer = {
  id: string;
  kind: "carried" | "stash" | "trunk" | "glovebox";
  title: string;
  subtitle: string | null;
  items: StaffInventoryItem[];
  totalItems: number;
  capped: boolean;
};

export type StaffPlayerInventory = {
  carried: StaffInventoryContainer | null;
  stashes: StaffInventoryContainer[];
  vehicles: StaffInventoryContainer[];
};

type SchemaTable = {
  tableName: string;
  columnSet: Set<string>;
};

function hasColumn(table: SchemaTable | null, column: string): boolean {
  return !!table?.columnSet.has(column.toLowerCase());
}

function getField(row: Record<string, unknown>, name: string): unknown {
  if (name in row) return row[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lower) return row[key];
  }
  return undefined;
}

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function quote(identifier: string): string {
  return quoteFiveMIdentifier(identifier);
}

function selectColumns(table: SchemaTable, columns: string[]): string[] {
  return columns.filter((column) => hasColumn(table, column));
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

async function loadTable(name: string): Promise<SchemaTable | null> {
  return getFiveMSchemaTable(name);
}

function makeContainer(input: {
  id: string;
  kind: StaffInventoryContainer["kind"];
  title: string;
  subtitle?: string | null;
  raw: unknown;
}): StaffInventoryContainer | null {
  const parsed = parseInventoryItems(input.raw);
  if (parsed.totalItems === 0 && input.kind !== "carried") return null;
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    subtitle: input.subtitle ?? null,
    items: parsed.items,
    totalItems: parsed.totalItems,
    capped: parsed.capped,
  };
}

type OxRow = {
  owner: string | null;
  name: string;
  data: unknown;
};

async function fetchOxRowsByNames(table: SchemaTable, names: string[]): Promise<OxRow[]> {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  if (uniqueNames.length === 0) return [];
  if (!hasColumn(table, "name") || !hasColumn(table, "data")) return [];

  const rows: OxRow[] = [];
  for (const group of chunk(uniqueNames, 40)) {
    const placeholders = group.map(() => "?").join(", ");
    const sql = `
      SELECT *
      FROM ${quote(table.tableName)}
      WHERE ${quote("name")} IN (${placeholders})
    `;
    const matches = await queryFiveMRows<RowDataPacket>(sql, group);
    for (const raw of matches) {
      const row = raw as Record<string, unknown>;
      const name = normalizeText(getField(row, "name"));
      if (!name) continue;
      rows.push({
        owner: normalizeText(getField(row, "owner")),
        name,
        data: getField(row, "data"),
      });
    }
  }
  return rows;
}

async function fetchOxRowsByOwner(table: SchemaTable, owner: string): Promise<OxRow[]> {
  if (!hasColumn(table, "owner") || !hasColumn(table, "name") || !hasColumn(table, "data")) {
    return [];
  }
  const sql = `
    SELECT *
    FROM ${quote(table.tableName)}
    WHERE ${quote("owner")} = ?
    LIMIT ?
  `;
  const matches = await queryFiveMRows<RowDataPacket>(sql, [owner, MAX_STASH_ROWS]);
  return matches
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      const name = normalizeText(getField(row, "name"));
      if (!name) return null;
      return {
        owner: normalizeText(getField(row, "owner")),
        name,
        data: getField(row, "data"),
      } satisfies OxRow;
    })
    .filter((row): row is OxRow => row != null);
}

async function fetchOxRowsByNamePrefix(table: SchemaTable, prefixes: string[]): Promise<OxRow[]> {
  const unique = Array.from(new Set(prefixes.map((value) => value.trim()).filter(Boolean)));
  if (unique.length === 0 || !hasColumn(table, "name") || !hasColumn(table, "data")) return [];

  const rows: OxRow[] = [];
  for (const group of chunk(unique, 20)) {
    const parts = group.map(() => `${quote("name")} LIKE ?`);
    const sql = `
      SELECT *
      FROM ${quote(table.tableName)}
      WHERE ${parts.join(" OR ")}
      LIMIT ?
    `;
    const matches = await queryFiveMRows<RowDataPacket>(sql, [
      ...group.map((prefix) => `${prefix}%`),
      MAX_STASH_ROWS,
    ]);
    for (const raw of matches) {
      const row = raw as Record<string, unknown>;
      const name = normalizeText(getField(row, "name"));
      if (!name) continue;
      rows.push({
        owner: normalizeText(getField(row, "owner")),
        name,
        data: getField(row, "data"),
      });
    }
  }
  return rows;
}

function titleForOxStash(name: string, owner: string | null): string {
  if (/^property_\d+_interactable_point_\d+$/i.test(name)) {
    const match = name.match(/^property_(\d+)_interactable_point_(\d+)$/i);
    return match ? `Property ${match[1]} stash ${match[2]}` : name;
  }
  if (name.toLowerCase().endsWith("locker") || name.toLowerCase().endsWith("stash")) {
    return name;
  }
  return owner ? `${name}` : name;
}

async function fetchCarried(
  identifier: string,
  players: SchemaTable | null,
  ox: SchemaTable | null
): Promise<{ container: StaffInventoryContainer | null; raw: unknown }> {
  if (players && hasColumn(players, "inventory")) {
    const idColumn = hasColumn(players, "citizenid")
      ? "citizenid"
      : hasColumn(players, "identifier")
        ? "identifier"
        : null;
    if (idColumn) {
      const sql = `
        SELECT ${quote("inventory")}
        FROM ${quote(players.tableName)}
        WHERE ${quote(idColumn)} = ?
        LIMIT 1
      `;
      const rows = await queryFiveMRows<RowDataPacket>(sql, [identifier]);
      if (rows[0]) {
        const raw = getField(rows[0] as Record<string, unknown>, "inventory");
        return {
          raw,
          container: {
            id: "carried:players.inventory",
            kind: "carried",
            title: "Carried",
            subtitle: `${players.tableName}.inventory`,
            ...parseInventoryItems(raw),
          },
        };
      }
    }
  }

  if (ox) {
    const rows = await fetchOxRowsByNames(ox, playerInventoryNames(identifier));
    const match =
      rows.find((row) => row.name.toLowerCase() === `player-${identifier}`.toLowerCase()) ||
      rows.find((row) => row.name.toLowerCase() === identifier.toLowerCase()) ||
      rows[0];
    if (match) {
      return {
        raw: match.data,
        container: {
          id: `carried:ox:${match.name}`,
          kind: "carried",
          title: "Carried",
          subtitle: `${ox.tableName}.${match.name}`,
          ...parseInventoryItems(match.data),
        },
      };
    }
  }

  return { container: null, raw: null };
}

async function fetchLinkedPropertyIds(identifier: string): Promise<Map<string, string>> {
  const properties = await loadTable("properties");
  const owners = await loadTable("properties_owners");
  const renters = await loadTable("properties_renters");
  const labels = new Map<string, string>();

  if (properties && owners && hasColumn(owners, "identifier") && hasColumn(owners, "property_id")) {
    const typeFilter = hasColumn(owners, "type") ? `AND (${quote("type")} = ? OR ${quote("type")} IS NULL)` : "";
    const params: unknown[] = [identifier];
    if (typeFilter) params.push("user");
    const sql = `
      SELECT ${quote(owners.tableName)}.${quote("property_id")} AS propertyId
      FROM ${quote(owners.tableName)}
      WHERE ${quote(owners.tableName)}.${quote("identifier")} = ?
      ${typeFilter}
    `;
    const rows = await queryFiveMRows<RowDataPacket>(sql, params);
    for (const raw of rows) {
      const id = normalizeText(getField(raw as Record<string, unknown>, "propertyId"));
      if (id) labels.set(id, `Property ${id}`);
    }
  }

  if (properties && renters && hasColumn(renters, "identifier") && hasColumn(renters, "property_id")) {
    const sql = `
      SELECT ${quote("property_id")} AS propertyId
      FROM ${quote(renters.tableName)}
      WHERE ${quote("identifier")} = ?
    `;
    const rows = await queryFiveMRows<RowDataPacket>(sql, [identifier]);
    for (const raw of rows) {
      const id = normalizeText(getField(raw as Record<string, unknown>, "propertyId"));
      if (id) labels.set(id, `Property ${id} (renter)`);
    }
  }

  if (properties && hasColumn(properties, "keyholders")) {
    const selected = selectColumns(properties, ["id", "label", "address", "keyholders"]);
    if (selected.includes("id")) {
      const sql = `
        SELECT ${selected.map(quote).join(", ")}
        FROM ${quote(properties.tableName)}
        WHERE ${quote("keyholders")} LIKE ?
      `;
      const rows = await queryFiveMRows<RowDataPacket>(sql, [`%"${identifier}"%`]);
      for (const raw of rows) {
        const row = raw as Record<string, unknown>;
        const id = normalizeText(getField(row, "id"));
        if (!id) continue;
        const label =
          normalizeText(getField(row, "label")) ||
          normalizeText(getField(row, "address")) ||
          `Property ${id}`;
        if (!labels.has(id)) labels.set(id, `${label} (keyholder)`);
        else if (!labels.get(id)?.includes("(")) labels.set(id, label);
      }
    }
  }

  if (properties && labels.size > 0 && (hasColumn(properties, "label") || hasColumn(properties, "address"))) {
    const ids = Array.from(labels.keys());
    for (const group of chunk(ids, 40)) {
      const selected = selectColumns(properties, ["id", "label", "address"]);
      const sql = `
        SELECT ${selected.map(quote).join(", ")}
        FROM ${quote(properties.tableName)}
        WHERE ${quote("id")} IN (${group.map(() => "?").join(", ")})
      `;
      const rows = await queryFiveMRows<RowDataPacket>(sql, group);
      for (const raw of rows) {
        const row = raw as Record<string, unknown>;
        const id = normalizeText(getField(row, "id"));
        if (!id) continue;
        const label =
          normalizeText(getField(row, "label")) ||
          normalizeText(getField(row, "address"));
        if (label) {
          const existing = labels.get(id) || "";
          const suffix = existing.includes("(renter)")
            ? " (renter)"
            : existing.includes("(keyholder)")
              ? " (keyholder)"
              : "";
          labels.set(id, `${label}${suffix}`);
        }
      }
    }
  }

  return labels;
}

async function fetchHouseStashes(identifier: string): Promise<StaffInventoryContainer[]> {
  const houses = await loadTable("player_houses");
  if (!houses || !hasColumn(houses, "stash")) return [];
  const idColumn = hasColumn(houses, "citizenid")
    ? "citizenid"
    : hasColumn(houses, "identifier")
      ? "identifier"
      : null;
  if (!idColumn) return [];

  const selected = selectColumns(houses, ["house", "stash", idColumn]);
  const sql = `
    SELECT ${selected.map(quote).join(", ")}
    FROM ${quote(houses.tableName)}
    WHERE ${quote(idColumn)} = ?
    LIMIT ?
  `;
  const rows = await queryFiveMRows<RowDataPacket>(sql, [identifier, MAX_STASH_ROWS]);
  return rows
    .map((raw, index) => {
      const row = raw as Record<string, unknown>;
      const house = normalizeText(getField(row, "house")) || `House ${index + 1}`;
      return makeContainer({
        id: `stash:player_houses:${house}`,
        kind: "stash",
        title: house,
        subtitle: `${houses.tableName}.stash`,
        raw: getField(row, "stash"),
      });
    })
    .filter((container): container is StaffInventoryContainer => container != null);
}

async function fetchNamedLockers(identifier: string, ox: SchemaTable | null): Promise<string[]> {
  const names: string[] = [];

  const lockers = await loadTable("lockers");
  if (lockers && hasColumn(lockers, "citizenid")) {
    const selected = selectColumns(lockers, ["name", "label", "citizenid"]);
    const sql = `
      SELECT ${selected.map(quote).join(", ")}
      FROM ${quote(lockers.tableName)}
      WHERE ${quote("citizenid")} = ?
      LIMIT ?
    `;
    const rows = await queryFiveMRows<RowDataPacket>(sql, [identifier, MAX_STASH_ROWS]);
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      const name = normalizeText(getField(row, "name"));
      if (name) names.push(name);
    }
  }

  const storage = await loadTable("storagelockers");
  if (storage && hasColumn(storage, "owner") && hasColumn(storage, "name")) {
    const sql = `
      SELECT ${quote("name")}
      FROM ${quote(storage.tableName)}
      WHERE ${quote("owner")} = ?
      LIMIT ?
    `;
    const rows = await queryFiveMRows<RowDataPacket>(sql, [identifier, MAX_STASH_ROWS]);
    for (const raw of rows) {
      const name = normalizeText(getField(raw as Record<string, unknown>, "name"));
      if (name) names.push(name);
    }
  }

  if (ox) {
    const extra = names.flatMap((name) => [name, `stash-${name}`, `locker-${name}`]);
    return extra;
  }
  return names;
}

function classifyVehicleOxName(name: string, plates: Set<string>): "trunk" | "glovebox" | null {
  const lower = name.toLowerCase();
  if (lower.startsWith("glove") || lower.includes("glovebox") || lower.startsWith("glove-")) {
    return "glovebox";
  }
  if (lower.startsWith("trunk")) return "trunk";

  for (const plate of plates) {
    const compact = plate.replace(/[\s-]/g, "").toLowerCase();
    if (lower === `ls${compact}` || lower === compact) return "trunk";
  }
  return null;
}

async function fetchVehicleContainers(
  identifier: string,
  ox: SchemaTable | null
): Promise<StaffInventoryContainer[]> {
  const vehicles = await loadTable("player_vehicles");
  if (!vehicles) return [];

  const ownerColumn = hasColumn(vehicles, "citizenid")
    ? "citizenid"
    : hasColumn(vehicles, "owner")
      ? "owner"
      : null;
  if (!ownerColumn) return [];

  const selected = selectColumns(vehicles, [
    "plate",
    "fakeplate",
    "vehicle",
    "nickname",
    "trunk",
    "glovebox",
    ownerColumn,
  ]);
  if (!selected.includes("plate") && !hasColumn(vehicles, "trunk") && !hasColumn(vehicles, "glovebox")) {
    return [];
  }

  const sql = `
    SELECT ${selected.map(quote).join(", ")}
    FROM ${quote(vehicles.tableName)}
    WHERE ${quote(ownerColumn)} = ?
    LIMIT ?
  `;
  const rows = await queryFiveMRows<RowDataPacket>(sql, [identifier, MAX_VEHICLES]);
  const containers: StaffInventoryContainer[] = [];
  const plates = new Set<string>();
  const plateLabels = new Map<string, string>();

  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const plate = normalizeText(getField(row, "plate"));
    const fakeplate = normalizeText(getField(row, "fakeplate"));
    const model = normalizeText(getField(row, "vehicle"));
    const nickname = normalizeText(getField(row, "nickname"));
    const labelParts = [plate, nickname && nickname !== plate ? nickname : null, model].filter(Boolean);
    const vehicleLabel = labelParts.join(" · ") || "Vehicle";

    if (plate) {
      plates.add(plate);
      plateLabels.set(plate.replace(/[\s-]/g, "").toUpperCase(), vehicleLabel);
    }
    if (fakeplate) plates.add(fakeplate);

    if (hasColumn(vehicles, "trunk")) {
      const trunk = makeContainer({
        id: `trunk:player_vehicles:${plate || "unknown"}`,
        kind: "trunk",
        title: `Trunk · ${vehicleLabel}`,
        subtitle: `${vehicles.tableName}.trunk`,
        raw: getField(row, "trunk"),
      });
      if (trunk) containers.push(trunk);
    }

    if (hasColumn(vehicles, "glovebox")) {
      const glove = makeContainer({
        id: `glovebox:player_vehicles:${plate || "unknown"}`,
        kind: "glovebox",
        title: `Glovebox · ${vehicleLabel}`,
        subtitle: `${vehicles.tableName}.glovebox`,
        raw: getField(row, "glovebox"),
      });
      if (glove) containers.push(glove);
    }
  }

  if (ox && plates.size > 0) {
    const names = Array.from(plates).flatMap((plate) => vehicleInventoryNames(plate));
    const oxRows = await fetchOxRowsByNames(ox, names);
    const seenIds = new Set(containers.map((container) => container.id));
    for (const row of oxRows) {
      const kind = classifyVehicleOxName(row.name, plates);
      if (!kind) continue;
      const compact = row.name.replace(/^ls/i, "").replace(/^(trunk-|trunk|glovebox-|glovebox|glove-)/i, "");
      const label =
        plateLabels.get(compact.toUpperCase()) ||
        plateLabels.get(row.name.replace(/^ls/i, "").toUpperCase()) ||
        row.name;
      const container = makeContainer({
        id: `${kind}:ox:${row.name}`,
        kind,
        title: `${kind === "glovebox" ? "Glovebox" : "Trunk"} · ${label}`,
        subtitle: `${ox.tableName}.${row.name}`,
        raw: row.data,
      });
      if (container && !seenIds.has(container.id)) {
        seenIds.add(container.id);
        containers.push(container);
      }
    }
  }

  return containers;
}

function stashFromOx(row: OxRow, tableName: string, title?: string): StaffInventoryContainer | null {
  return makeContainer({
    id: `stash:ox:${row.owner || ""}:${row.name}`,
    kind: "stash",
    title: title || titleForOxStash(row.name, row.owner),
    subtitle: `${tableName} · ${row.name}${row.owner ? ` · owner ${row.owner}` : ""}`,
    raw: row.data,
  });
}

function collectContainerIdsFromItems(items: StaffInventoryItem[]): string[] {
  return items
    .map((item) => item.containerId)
    .filter((id): id is string => !!id);
}

async function fetchNestedContainers(
  ox: SchemaTable,
  rawSources: unknown[],
  itemSources: StaffInventoryItem[],
  already: Set<string>
): Promise<StaffInventoryContainer[]> {
  const ids = new Set<string>();
  for (const raw of rawSources) {
    for (const id of collectContainerIds(raw)) {
      if (!already.has(id.toLowerCase())) ids.add(id);
    }
  }
  for (const id of collectContainerIdsFromItems(itemSources)) {
    if (!already.has(id.toLowerCase())) ids.add(id);
  }
  if (ids.size === 0) return [];

  const rows = await fetchOxRowsByNames(ox, Array.from(ids));
  return rows
    .map((row) => {
      already.add(row.name.toLowerCase());
      return makeContainer({
        id: `stash:container:${row.name}`,
        kind: "stash",
        title: `Container ${row.name}`,
        subtitle: `${ox.tableName}.${row.name}`,
        raw: row.data,
      });
    })
    .filter((container): container is StaffInventoryContainer => container != null);
}

export async function getStaffPlayerInventory(
  identifier: string
): Promise<StaffPlayerInventory | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (!hasFiveMDbConfig()) return null;

  try {
    const [players, ox] = await Promise.all([loadTable("players"), loadTable("ox_inventory")]);
    const vehiclesTable = await loadTable("player_vehicles");
    const houses = await loadTable("player_houses");
    const lockers = await loadTable("lockers");
    const storage = await loadTable("storagelockers");
    const properties = await loadTable("properties");

    const canCarry = !!(players && hasColumn(players, "inventory")) || !!ox;
    const canStash = !!(ox || (houses && hasColumn(houses, "stash")) || lockers || storage || properties);
    const canVehicles = !!(
      vehiclesTable &&
      (hasColumn(vehiclesTable, "trunk") || hasColumn(vehiclesTable, "glovebox") || ox)
    );

    if (!canCarry && !canStash && !canVehicles) return null;

    const [carriedResult, ownedOx, propertyLabels, houseStashes, lockerNames, vehicleContainers] =
      await Promise.all([
        canCarry ? fetchCarried(trimmed, players, ox) : Promise.resolve({ container: null, raw: null }),
        ox && canStash ? fetchOxRowsByOwner(ox, trimmed) : Promise.resolve([]),
        properties && ox ? fetchLinkedPropertyIds(trimmed) : Promise.resolve(new Map<string, string>()),
        houses ? fetchHouseStashes(trimmed) : Promise.resolve([]),
        ox ? fetchNamedLockers(trimmed, ox) : Promise.resolve([]),
        canVehicles ? fetchVehicleContainers(trimmed, ox) : Promise.resolve([]),
      ]);

    const stashes: StaffInventoryContainer[] = [...houseStashes];
    const seen = new Set<string>();

    for (const row of ownedOx) {
      const container = stashFromOx(row, ox!.tableName);
      if (!container) continue;
      const key = container.id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      stashes.push(container);
    }

    if (ox && propertyLabels.size > 0) {
      const prefixes = Array.from(propertyLabels.keys()).map((id) => `property_${id}_`);
      const propertyRows = await fetchOxRowsByNamePrefix(ox, prefixes);
      for (const row of propertyRows) {
        const match = row.name.match(/^property_(\d+)_/i);
        const propertyId = match?.[1];
        const title = propertyId
          ? `${propertyLabels.get(propertyId) || `Property ${propertyId}`} · ${row.name.replace(
              /^property_\d+_interactable_point_/i,
              "stash "
            )}`
          : row.name;
        const container = stashFromOx(row, ox.tableName, title);
        if (!container) continue;
        const key = container.id.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        stashes.push(container);
      }
    }

    if (ox && lockerNames.length > 0) {
      const lockerRows = await fetchOxRowsByNames(ox, lockerNames);
      for (const row of lockerRows) {
        const container = stashFromOx(row, ox.tableName);
        if (!container) continue;
        const key = container.id.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        stashes.push(container);
      }
    }

    if (ox) {
      const nested = await fetchNestedContainers(
        ox,
        [carriedResult.raw, ...ownedOx.map((row) => row.data)],
        [
          ...(carriedResult.container?.items ?? []),
          ...stashes.flatMap((container) => container.items),
          ...vehicleContainers.flatMap((container) => container.items),
        ],
        new Set([
          ...ownedOx.map((row) => row.name.toLowerCase()),
          ...playerInventoryNames(trimmed).map((name) => name.toLowerCase()),
        ])
      );
      for (const container of nested) {
        const key = container.id.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        stashes.push(container);
      }
    }

    if (!carriedResult.container && stashes.length === 0 && vehicleContainers.length === 0) {
      return canCarry
        ? { carried: carriedResult.container, stashes: [], vehicles: [] }
        : { carried: null, stashes: [], vehicles: [] };
    }

    return {
      carried: canCarry ? carriedResult.container : null,
      stashes,
      vehicles: vehicleContainers,
    };
  } catch {
    return null;
  }
}
