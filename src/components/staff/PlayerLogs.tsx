import { canUseAdvancedLogs, canViewLogs, canViewStaffPlayers, type PermissionContext } from "@/lib/permissions";
import type { PlayerLogParams } from "@/lib/player-logs";
import { LogExplorer } from "@/components/logs/LogExplorer";
import { prepareLogSearch } from "@/lib/log-service";
import { queryVictoriaLogs } from "@/lib/victorialogs";
import { scrubLogEntry } from "@/lib/log-events";
import { RecentLogActivity } from "@/components/logs/RecentLogActivity";
export async function PlayerLogs({ identifier, params, permissions, recent = false }: { identifier: string; params: PlayerLogParams; permissions: PermissionContext | null; recent?: boolean }) {
  if (!canViewStaffPlayers(permissions) || !canViewLogs(permissions)) return null;
  if (!recent) return <LogExplorer params={params} lockedPlayer={identifier} advanced={canUseAdvancedLogs(permissions)} players />;
  let entries;
  try {
    const { input, advanced } = await prepareLogSearch({ range: "24h" }, permissions, identifier);
    const result = await queryVictoriaLogs({ ...input, query: `${input.query} | sort by (_time) desc limit 10`, limit: 10 });
    if (result.error) throw new Error(result.error);
    entries = advanced ? result.entries : result.entries.map(scrubLogEntry);
  } catch { entries = null; }
  return entries ? <RecentLogActivity entries={entries} identifier={identifier} /> : <p role="alert" className="text-xs text-danger">Recent activity is unavailable. Open the Logs tab to retry.</p>;
}
