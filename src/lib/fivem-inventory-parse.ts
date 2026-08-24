export const INVENTORY_ITEM_CAP = 100;

export type StaffInventoryItem = {
  name: string;
  count: number;
  slot: number | null;
  label: string | null;
  details: string[];
  containerId: string | null;
};

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseJson(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return parseJson(JSON.parse(trimmed));
    } catch {
      return value;
    }
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

export function coerceInventoryArray(value: unknown): unknown[] {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed;
  const record = asRecord(parsed);
  if (!record) return [];
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.inventory)) return record.inventory;

  const slotEntries = Object.entries(record).filter(([key]) => /^\d+$/.test(key));
  if (slotEntries.length === 0) return [];
  return slotEntries
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, entry]) => {
      const item = asRecord(entry);
      if (!item || item.slot != null) return entry;
      return { ...item, slot: Number(key) };
    });
}

function formatDetail(label: string, value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  return `${label} ${text}`;
}

export function mapInventoryItem(value: unknown): StaffInventoryItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const name = normalizeText(record.name) || normalizeText(record.item);
  if (!name) return null;

  const count = toNumber(record.count) ?? toNumber(record.amount) ?? toNumber(record.quantity) ?? 1;
  if (count <= 0) return null;

  const metadata = asRecord(record.metadata) || asRecord(record.info);
  const label = normalizeText(metadata?.label) || normalizeText(record.label) || null;

  const details: string[] = [];
  const serial = formatDetail("serial", metadata?.serial);
  if (serial) details.push(serial);
  const ammo = formatDetail("ammo", metadata?.ammo);
  if (ammo) details.push(ammo);
  const registered = formatDetail("registered", metadata?.registered);
  if (registered) details.push(registered);

  const durability = toNumber(metadata?.durability);
  if (durability != null && durability >= 0 && durability < 100) {
    details.push(`durability ${Math.round(durability)}`);
  }

  const container = normalizeText(metadata?.container);
  if (container) details.push(`container ${container}`);

  return {
    name,
    count,
    slot: toNumber(record.slot),
    label: label && label.toLowerCase() !== name.toLowerCase() ? label : null,
    details,
    containerId: container,
  };
}

export function parseInventoryItems(
  value: unknown,
  cap = INVENTORY_ITEM_CAP
): { items: StaffInventoryItem[]; totalItems: number; capped: boolean } {
  const mapped = coerceInventoryArray(value)
    .map(mapInventoryItem)
    .filter((item): item is StaffInventoryItem => item != null)
    .sort((a, b) => (a.slot ?? 9999) - (b.slot ?? 9999) || a.name.localeCompare(b.name));

  return {
    items: mapped.slice(0, cap),
    totalItems: mapped.length,
    capped: mapped.length > cap,
  };
}

export function collectContainerIds(value: unknown): string[] {
  const ids = new Set<string>();
  for (const entry of coerceInventoryArray(value)) {
    const record = asRecord(entry);
    const metadata = asRecord(record?.metadata) || asRecord(record?.info);
    const container = normalizeText(metadata?.container);
    if (container) ids.add(container);
  }
  return Array.from(ids);
}

export function vehicleInventoryNames(plate: string): string[] {
  const trimmed = plate.trim();
  if (!trimmed) return [];

  const compact = trimmed.replace(/[\s-]/g, "");
  const variants = Array.from(
    new Set([trimmed, compact, trimmed.toUpperCase(), compact.toUpperCase()])
  ).filter(Boolean);

  const names = new Set<string>();
  for (const plateValue of variants) {
    names.add(plateValue);
    names.add(`LS${plateValue}`);
    names.add(`trunk-${plateValue}`);
    names.add(`trunk${plateValue}`);
    names.add(`glove-${plateValue}`);
    names.add(`glovebox-${plateValue}`);
    names.add(`glove${plateValue}`);
    names.add(`glovebox${plateValue}`);
  }
  return Array.from(names);
}

export function playerInventoryNames(identifier: string): string[] {
  const trimmed = identifier.trim();
  if (!trimmed) return [];
  return Array.from(
    new Set([trimmed, `player-${trimmed}`, `player${trimmed}`, `stash-${trimmed}`])
  );
}
