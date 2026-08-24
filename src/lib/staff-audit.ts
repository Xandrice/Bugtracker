import "server-only";

import { db } from "@/lib/db";

export const STAFF_AUDIT_ACTIONS = {
  TOGGLE_BAN: "TOGGLE_BAN",
  TOGGLE_WHITELIST: "TOGGLE_WHITELIST",
  TOGGLE_STORAGE: "TOGGLE_STORAGE",
  PUT_AWAY: "PUT_AWAY",
} as const;

export type StaffAuditAction =
  (typeof STAFF_AUDIT_ACTIONS)[keyof typeof STAFF_AUDIT_ACTIONS];

export type StaffAuditTargetType = "player" | "vehicle";

export type StaffAuditEventView = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetKey: string;
  targetLabel: string | null;
  playerKey: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

export type RecordStaffAuditEventInput = {
  actorId: string;
  actorName: string;
  action: StaffAuditAction;
  targetType: StaffAuditTargetType;
  targetKey: string;
  targetLabel?: string | null;
  playerKey?: string | null;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export function formatFlagAuditValue(value: boolean): string {
  return value ? "true" : "false";
}

function mapAuditEvent(event: {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetKey: string;
  targetLabel: string | null;
  playerKey: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}): StaffAuditEventView {
  return {
    id: event.id,
    actorId: event.actorId,
    actorName: event.actorName,
    action: event.action,
    targetType: event.targetType,
    targetKey: event.targetKey,
    targetLabel: event.targetLabel,
    playerKey: event.playerKey,
    field: event.field,
    oldValue: event.oldValue,
    newValue: event.newValue,
    createdAt: event.createdAt,
  };
}

export async function recordStaffAuditEvent(
  input: RecordStaffAuditEventInput
): Promise<void> {
  try {
    const actor = await db.user.findUnique({
      where: { id: input.actorId },
      select: { id: true },
    });
    await db.staffAuditEvent.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: input.actorName,
        action: input.action,
        targetType: input.targetType,
        targetKey: input.targetKey,
        targetLabel: input.targetLabel || null,
        playerKey: input.playerKey || null,
        field: input.field,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to record staff audit event", err);
  }
}

export async function listRecentStaffAuditEvents(
  limit = 15
): Promise<StaffAuditEventView[]> {
  try {
    const events = await db.staffAuditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 50)),
    });
    return events.map(mapAuditEvent);
  } catch (err) {
    console.error("Failed to load staff audit events", err);
    return [];
  }
}

export async function listPlayerStaffAuditEvents(input: {
  playerIdentifier: string;
  vehicleKeys?: string[];
  limit?: number;
}): Promise<StaffAuditEventView[]> {
  const playerIdentifier = input.playerIdentifier.trim();
  if (!playerIdentifier) return [];

  const vehicleKeys = (input.vehicleKeys || []).map((key) => key.trim()).filter(Boolean);
  const orFilters: Array<
    | { targetType: string; targetKey: string }
    | { playerKey: string }
    | { targetType: string; targetKey: { in: string[] } }
  > = [
    { targetType: "player", targetKey: playerIdentifier },
    { playerKey: playerIdentifier },
  ];
  if (vehicleKeys.length > 0) {
    orFilters.push({ targetType: "vehicle", targetKey: { in: vehicleKeys } });
  }

  try {
    const events = await db.staffAuditEvent.findMany({
      where: { OR: orFilters },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(input.limit ?? 20, 50)),
    });
    return events.map(mapAuditEvent);
  } catch (err) {
    console.error("Failed to load player staff audit events", err);
    return [];
  }
}

export function formatStaffAuditAction(event: StaffAuditEventView): string {
  switch (event.action) {
    case STAFF_AUDIT_ACTIONS.TOGGLE_BAN:
      return event.newValue === "true" ? "banned this player" : "unbanned this player";
    case STAFF_AUDIT_ACTIONS.TOGGLE_WHITELIST:
      return event.newValue === "true"
        ? "whitelisted this player"
        : "removed whitelist from this player";
    case STAFF_AUDIT_ACTIONS.TOGGLE_STORAGE:
      return event.newValue === "stored"
        ? "marked this vehicle stored"
        : "marked this vehicle out";
    case STAFF_AUDIT_ACTIONS.PUT_AWAY:
      return event.newValue
        ? `put this vehicle away in ${event.newValue}`
        : "put this vehicle away";
    default:
      return event.action.replace(/_/g, " ").toLowerCase();
  }
}

export function staffAuditTargetHref(event: StaffAuditEventView): string | null {
  const playerKey = event.playerKey || (event.targetType === "player" ? event.targetKey : null);
  if (!playerKey) return null;
  return `/staff-tools/players/${encodeURIComponent(playerKey)}`;
}

export function staffAuditTargetLabel(event: StaffAuditEventView): string {
  if (event.targetType === "vehicle") {
    return event.targetLabel || event.targetKey;
  }
  return event.targetLabel || event.targetKey;
}
