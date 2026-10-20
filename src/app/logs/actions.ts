"use server";

import { auth } from "@/../auth";
import { getPermissionContext, canViewLogs, canViewStaffPlayers } from "@/lib/permissions";
import { searchLogs } from "@/lib/log-service";
import { searchStaffLogPlayers } from "@/lib/fivem-db";
import type { PlayerLogParams } from "@/lib/player-logs";

export async function searchLogsAction(params: PlayerLogParams, lockedPlayer?: string, older = false) {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  return searchLogs(params, permissions, lockedPlayer, older);
}
export async function searchLogPlayers(query: string) {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  if (!canViewLogs(permissions) || !canViewStaffPlayers(permissions)) throw new Error("Player search is not permitted.");
  if (query.trim().length < 2) return [];
  return searchStaffLogPlayers(query.trim().slice(0, 100));
}
