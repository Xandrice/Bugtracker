"use server";

import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAccessStaffTools,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import {
  refreshFiveMSchemaCache,
  togglePlayerFlag,
  toggleVehicleStorageState,
} from "@/lib/fivem-db";

function redirectToSignIn(): never {
  redirect("/api/auth/signin?callbackUrl=/staff-tools");
}

async function ensureStaffAccess() {
  const session = await auth();
  if (!session?.user?.id) redirectToSignIn();

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canAccessStaffTools(permissions),
    "You do not have permission to access staff tools."
  );
  if (denied) throw new Error(denied.error);
}

export async function togglePlayerBanAction(formData: FormData) {
  await ensureStaffAccess();

  const identifier = String(formData.get("playerIdentifier") || "").trim();
  if (!identifier) throw new Error("Missing player identifier.");

  await togglePlayerFlag(identifier, "banned");
  revalidatePath("/staff-tools");
}

export async function togglePlayerWhitelistAction(formData: FormData) {
  await ensureStaffAccess();

  const identifier = String(formData.get("playerIdentifier") || "").trim();
  if (!identifier) throw new Error("Missing player identifier.");

  await togglePlayerFlag(identifier, "whitelisted");
  revalidatePath("/staff-tools");
}

export async function toggleVehicleStorageAction(formData: FormData) {
  await ensureStaffAccess();

  const vehicleKey = String(formData.get("vehicleKey") || "").trim();
  if (!vehicleKey) throw new Error("Missing vehicle key.");

  await toggleVehicleStorageState(vehicleKey);
  revalidatePath("/staff-tools");
}

export async function refreshStaffSchemaAction() {
  await ensureStaffAccess();
  await refreshFiveMSchemaCache();
  revalidatePath("/staff-tools");
}
