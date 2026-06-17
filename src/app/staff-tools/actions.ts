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

function redirectToSignIn(callbackUrl = "/staff-tools"): never {
  redirect(discordSignInUrl(callbackUrl));
}

async function ensureStaffPermission(allowed: (permissions: Awaited<ReturnType<typeof getPermissionContext>>) => boolean) {
  const session = await auth();
  if (!session?.user?.id) redirectToSignIn();

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    allowed(permissions),
    "You do not have permission to access staff tools."
  );
  if (denied) throw new Error(denied.error);
}

function revalidateStaffToolPages() {
  revalidatePath("/staff-tools");
  revalidatePath("/staff-tools/players");
  revalidatePath("/staff-tools/vehicles");
  revalidatePath("/staff-tools/economy");
}

export async function togglePlayerBanAction(formData: FormData) {
  await ensureStaffPermission(canManageStaffPlayers);

  const identifier = String(formData.get("playerIdentifier") || "").trim();
  if (!identifier) throw new Error("Missing player identifier.");

  await togglePlayerFlag(identifier, "banned");
  revalidateStaffToolPages();
}

export async function togglePlayerWhitelistAction(formData: FormData) {
  await ensureStaffPermission(canManageStaffPlayers);

  const identifier = String(formData.get("playerIdentifier") || "").trim();
  if (!identifier) throw new Error("Missing player identifier.");

  await togglePlayerFlag(identifier, "whitelisted");
  revalidateStaffToolPages();
}

export async function toggleVehicleStorageAction(formData: FormData) {
  await ensureStaffPermission(canManageStaffVehicles);

  const vehicleKey = String(formData.get("vehicleKey") || "").trim();
  if (!vehicleKey) throw new Error("Missing vehicle key.");

  await toggleVehicleStorageState(vehicleKey);
  revalidateStaffToolPages();
}

export async function putAwayVehicleAction(formData: FormData) {
  await ensureStaffPermission(canManageStaffVehicles);

  const vehicleKey = String(formData.get("vehicleKey") || "").trim();
  const garageName = String(formData.get("garageName") || "").trim();
  if (!vehicleKey) throw new Error("Missing vehicle key.");
  if (!garageName) throw new Error("Missing garage name.");

  await putVehicleInGarage(vehicleKey, garageName);
  revalidateStaffToolPages();
}

export async function refreshStaffSchemaAction() {
  await ensureStaffPermission(canRefreshStaffSchema);
  await refreshFiveMSchemaCache();
  revalidateStaffToolPages();
}

export async function captureSnapshotAction() {
  await ensureStaffPermission(canAccessAnyStaffTool);
  await captureMetricSnapshot();
  revalidatePath("/staff-tools/dashboard");
}
