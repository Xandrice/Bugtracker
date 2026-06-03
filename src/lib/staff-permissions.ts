export type StaffPanelPermissions = {
  players: {
    view: boolean;
    manage: boolean;
  };
  vehicles: {
    view: boolean;
    manage: boolean;
  };
  economy: {
    view: boolean;
  };
  schema: {
    refresh: boolean;
  };
};

export type StaffPermissionKey =
  | "players.view"
  | "players.manage"
  | "vehicles.view"
  | "vehicles.manage"
  | "economy.view"
  | "schema.refresh";

export const STAFF_PERMISSION_DEFINITIONS: Array<{
  key: StaffPermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: "players.view",
    label: "View players",
    description: "Open player search, profiles, character info, and player vehicle lists.",
  },
  {
    key: "players.manage",
    label: "Manage players",
    description: "Toggle player ban and whitelist status.",
  },
  {
    key: "vehicles.view",
    label: "View vehicles",
    description: "Open vehicle search, garages, stored state, and impound status.",
  },
  {
    key: "vehicles.manage",
    label: "Manage vehicles",
    description: "Toggle stored state and put vehicles away in garages.",
  },
  {
    key: "economy.view",
    label: "View economy",
    description: "Open server-wide cash, bank, and account totals.",
  },
  {
    key: "schema.refresh",
    label: "Refresh schema",
    description: "Refresh detected FiveM database tables and columns.",
  },
];

export const EMPTY_STAFF_PANEL_PERMISSIONS: StaffPanelPermissions = {
  players: { view: false, manage: false },
  vehicles: { view: false, manage: false },
  economy: { view: false },
  schema: { refresh: false },
};

export const FULL_STAFF_PANEL_PERMISSIONS: StaffPanelPermissions = {
  players: { view: true, manage: true },
  vehicles: { view: true, manage: true },
  economy: { view: true },
  schema: { refresh: true },
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeStaffPanelPermissions(
  value: unknown,
  fallback: StaffPanelPermissions = EMPTY_STAFF_PANEL_PERMISSIONS
): StaffPanelPermissions {
  const root = asRecord(value);
  const players = asRecord(root.players);
  const vehicles = asRecord(root.vehicles);
  const economy = asRecord(root.economy);
  const schema = asRecord(root.schema);

  const normalized: StaffPanelPermissions = {
    players: {
      view: readBoolean(players.view, fallback.players.view),
      manage: readBoolean(players.manage, fallback.players.manage),
    },
    vehicles: {
      view: readBoolean(vehicles.view, fallback.vehicles.view),
      manage: readBoolean(vehicles.manage, fallback.vehicles.manage),
    },
    economy: {
      view: readBoolean(economy.view, fallback.economy.view),
    },
    schema: {
      refresh: readBoolean(schema.refresh, fallback.schema.refresh),
    },
  };

  if (normalized.players.manage) normalized.players.view = true;
  if (normalized.vehicles.manage) normalized.vehicles.view = true;

  const hasManagePermission = normalized.players.manage || normalized.vehicles.manage;
  normalized.schema.refresh = normalized.schema.refresh && hasManagePermission;

  return normalized;
}

export function mergeStaffPanelPermissions(
  base: StaffPanelPermissions,
  overrides: unknown
): StaffPanelPermissions {
  if (!overrides) return normalizeStaffPanelPermissions(base);

  const root = asRecord(overrides);
  const players = asRecord(root.players);
  const vehicles = asRecord(root.vehicles);
  const economy = asRecord(root.economy);
  const schema = asRecord(root.schema);

  return normalizeStaffPanelPermissions({
    players: {
      view: typeof players.view === "boolean" ? players.view : base.players.view,
      manage: typeof players.manage === "boolean" ? players.manage : base.players.manage,
    },
    vehicles: {
      view: typeof vehicles.view === "boolean" ? vehicles.view : base.vehicles.view,
      manage: typeof vehicles.manage === "boolean" ? vehicles.manage : base.vehicles.manage,
    },
    economy: {
      view: typeof economy.view === "boolean" ? economy.view : base.economy.view,
    },
    schema: {
      refresh: typeof schema.refresh === "boolean" ? schema.refresh : base.schema.refresh,
    },
  });
}

export function getStaffPermissionValue(
  permissions: StaffPanelPermissions,
  key: StaffPermissionKey
): boolean {
  switch (key) {
    case "players.view":
      return permissions.players.view;
    case "players.manage":
      return permissions.players.manage;
    case "vehicles.view":
      return permissions.vehicles.view;
    case "vehicles.manage":
      return permissions.vehicles.manage;
    case "economy.view":
      return permissions.economy.view;
    case "schema.refresh":
      return permissions.schema.refresh;
  }
}

export function setStaffPermissionValue(
  permissions: StaffPanelPermissions,
  key: StaffPermissionKey,
  value: boolean
): StaffPanelPermissions {
  const next: StaffPanelPermissions = {
    players: { ...permissions.players },
    vehicles: { ...permissions.vehicles },
    economy: { ...permissions.economy },
    schema: { ...permissions.schema },
  };

  switch (key) {
    case "players.view":
      next.players.view = value;
      if (!value) next.players.manage = false;
      break;
    case "players.manage":
      next.players.manage = value;
      if (value) next.players.view = true;
      break;
    case "vehicles.view":
      next.vehicles.view = value;
      if (!value) next.vehicles.manage = false;
      break;
    case "vehicles.manage":
      next.vehicles.manage = value;
      if (value) next.vehicles.view = true;
      break;
    case "economy.view":
      next.economy.view = value;
      break;
    case "schema.refresh":
      next.schema.refresh = value;
      break;
  }

  return normalizeStaffPanelPermissions(next);
}
