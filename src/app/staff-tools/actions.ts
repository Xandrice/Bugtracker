"use server";

import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAccessAnyStaffTool,
  canManageStaffPlayers,
  canManageStaffVehicles,
  canRefreshStaffSchema,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import {
  putVehicleInGarage,
  refreshFiveMSchemaCache,
  togglePlayerFlag,
  toggleVehicleStorageState,
} from "@/lib/fivem-db";
import { captureMetricSnapshot } from "@/lib/staff-snapshots";
import { discordSignInUrl } from "@/lib/auth-urls";
import {
  formatFlagAuditValue,
  recordStaffAuditEvent,
  STAFF_AUDIT_ACTIONS,
} from "@/lib/staff-audit";

function redirectToSignIn(callbackUrl = "/staff-tools"): never {
  redirect(discordSignInUrl(callbackUrl));
}

async function ensureStaffActor(
  allowed: (permissions: Awaited<ReturnType<typeof getPermissionContext>>) => boolean
): Promise<{ id: string; name: string }> {
  const session = await auth();
  if (!session?.user?.id) redirectToSignIn();

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    allowed(permissions),
    "You do not have permission to access staff tools."
  );
  if (denied) throw new Error(denied.error);

  const name = session.user.name?.trim() || session.user.email?.trim() || "Staff";
  return { id: session.user.id, name };
}

function revalidateStaffToolPages(playerIdentifier?: string | null) {
  revalidatePath("/staff-tools");
  revalidatePath("/staff-tools/dashboard");
  revalidatePath("/staff-tools/players");
  revalidatePath("/staff-tools/vehicles");
  revalidatePath("/staff-tools/economy");
  if (playerIdentifier) {
    revalidatePath(`/staff-tools/players/${encodeURIComponent(playerIdentifier)}`);
  }
}

export async function togglePlayerBanAction(formData: FormData) {
  const actor = await ensureStaffActor(canManageStaffPlayers);

  const identifier = String(formData.get("playerIdentifier") || "").trim();
  if (!identifier) throw new Error("Missing player identifier.");

  const result = await togglePlayerFlag(identifier, "banned");
  await recordStaffAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    action: STAFF_AUDIT_ACTIONS.TOGGLE_BAN,
    targetType: "player",
    targetKey: result.identifier,
    playerKey: result.identifier,
    field: result.field,
    oldValue: formatFlagAuditValue(result.oldValue),
    newValue: formatFlagAuditValue(result.newValue),
  });
  revalidateStaffToolPages(result.identifier);
}

export async function togglePlayerWhitelistAction(formData: FormData) {
  const actor = await ensureStaffActor(canManageStaffPlayers);

  const identifier = String(formData.get("playerIdentifier") || "").trim();
  if (!identifier) throw new Error("Missing player identifier.");

  const result = await togglePlayerFlag(identifier, "whitelisted");
  await recordStaffAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    action: STAFF_AUDIT_ACTIONS.TOGGLE_WHITELIST,
    targetType: "player",
    targetKey: result.identifier,
    playerKey: result.identifier,
    field: result.field,
    oldValue: formatFlagAuditValue(result.oldValue),
    newValue: formatFlagAuditValue(result.newValue),
  });
  revalidateStaffToolPages(result.identifier);
}

export async function toggleVehicleStorageAction(formData: FormData) {
  const actor = await ensureStaffActor(canManageStaffVehicles);

  const vehicleKey = String(formData.get("vehicleKey") || "").trim();
  if (!vehicleKey) throw new Error("Missing vehicle key.");

  const result = await toggleVehicleStorageState(vehicleKey);
  await recordStaffAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    action: STAFF_AUDIT_ACTIONS.TOGGLE_STORAGE,
    targetType: "vehicle",
    targetKey: result.vehicleKey,
    targetLabel: result.plate,
    playerKey: result.ownerIdentifier,
    field: result.field,
    oldValue: result.oldValue,
    newValue: result.newValue,
  });
  revalidateStaffToolPages(result.ownerIdentifier);
}

export async function putAwayVehicleAction(formData: FormData) {
  const actor = await ensureStaffActor(canManageStaffVehicles);

  const vehicleKey = String(formData.get("vehicleKey") || "").trim();
  const garageName = String(formData.get("garageName") || "").trim();
  if (!vehicleKey) throw new Error("Missing vehicle key.");
  if (!garageName) throw new Error("Missing garage name.");

  const result = await putVehicleInGarage(vehicleKey, garageName);
  await recordStaffAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    action: STAFF_AUDIT_ACTIONS.PUT_AWAY,
    targetType: "vehicle",
    targetKey: result.vehicleKey,
    targetLabel: result.plate,
    playerKey: result.ownerIdentifier,
    field: result.field,
    oldValue: result.oldValue,
    newValue: result.newValue,
  });
  revalidateStaffToolPages(result.ownerIdentifier);
}

export async function refreshStaffSchemaAction() {
  await ensureStaffActor(canRefreshStaffSchema);
  await refreshFiveMSchemaCache();
  revalidateStaffToolPages();
}

export async function captureSnapshotAction() {
  await ensureStaffActor(canAccessAnyStaffTool);
  await captureMetricSnapshot();
  revalidatePath("/staff-tools/dashboard");
}
