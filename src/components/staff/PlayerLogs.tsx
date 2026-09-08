import { canViewLogs, canViewStaffPlayers, type PermissionContext } from "@/lib/permissions";
import { buildPlayerLogsQuery, resolvePlayerLogRange, type PlayerLogParams } from "@/lib/player-logs";
import { isVictoriaLogsConfigured, queryVictoriaLogs } from "@/lib/victorialogs";
import { PlayerLogResults } from "./PlayerLogControls";

export async function PlayerLogs({ identifier, params, permissions }: {
  identifier: string; params: PlayerLogParams; permissions: PermissionContext | null;
}) {
  if (!canViewStaffPlayers(permissions) || !canViewLogs(permissions)) return null;
  let range;
  let query;
  try {
    range = resolvePlayerLogRange(params);
    query = buildPlayerLogsQuery(identifier, range.limit);
  } catch (error) {
    return <p role="alert" className="text-sm text-danger">{error instanceof Error ? error.message : "Invalid log filters."}</p>;
  }
  if (!isVictoriaLogsConfigured()) return <p className="text-sm text-muted-foreground">Player logs are unavailable because logging is not configured.</p>;
  const result = await queryVictoriaLogs({ query, ...range });
  if (result.error) return <p role="alert" className="text-sm text-danger">Could not load player logs. Try Refresh in a moment.</p>;
  return <>
    {result.skippedLines > 0 && <p className="text-xs text-muted-foreground">Some malformed log entries could not be displayed.</p>}
    <PlayerLogResults entries={result.entries} {...range} />
  </>;
}
