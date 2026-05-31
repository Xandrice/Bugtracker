import Link from "next/link";
import { redirect } from "next/navigation";
import { Car, Coins, RefreshCcw, Shield, Users } from "lucide-react";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  canAccessStaffTools,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { getStaffToolsSnapshot } from "@/lib/fivem-db";
import {
  refreshStaffSchemaAction,
  togglePlayerBanAction,
  togglePlayerWhitelistAction,
} from "../actions";

function boolLabel(value: boolean | null, trueLabel: string, falseLabel: string) {
  if (value === true) return trueLabel;
  if (value === false) return falseLabel;
  return "N/A";
}

function formatCharInfo(charInfo: string | null): string {
  if (!charInfo) return "N/A";
  return charInfo;
}

function formatFullRow(row: Record<string, unknown>): string {
  return JSON.stringify(row, null, 2);
}

export default async function StaffPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ playerQ?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/staff-tools/players");
  }

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canAccessStaffTools(permissions),
    "You do not have permission to access staff tools."
  );
  if (denied) {
    return (
      <PageContainer>
        <PageHeader
          title="Staff tools"
          description="Access is limited to staff roles."
          icon={<Shield className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  const params = await searchParams;
  const playerQ = (params.playerQ || "").trim();

  const snapshot = await getStaffToolsSnapshot({
    playerSearch: playerQ,
    limit: 40,
  });

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Staff tools · Players"
        description="Manage player records in the game database."
        icon={<Users className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff-tools/vehicles"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <Car className="h-3.5 w-3.5" />
              Vehicles
            </Link>
            <Link
              href="/staff-tools/economy"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <Coins className="h-3.5 w-3.5" />
              Economy
            </Link>
            <form action={refreshStaffSchemaAction}>
              <Button type="submit" variant="outline" size="sm">
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh schema
              </Button>
            </form>
          </div>
        }
      />

      {!snapshot.configured && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle>Database config required</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-muted-foreground">
            <p>
              Set either <code>FIVEM_DB_URL</code> or split credentials with{" "}
              <code>FIVEM_DB_HOST</code>, <code>FIVEM_DB_PORT</code>, <code>FIVEM_DB_USER</code>,{" "}
              <code>FIVEM_DB_PASSWORD</code>, and <code>FIVEM_DB_NAME</code>.
            </p>
            <p>After saving env vars, restart the dev server and refresh this page.</p>
          </CardBody>
        </Card>
      )}

      {snapshot.connectionError && (
        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle>Unable to connect to FiveM database</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-danger">
            <p>{snapshot.connectionError}</p>
            <p className="text-muted-foreground">
              Confirm your database host/firewall credentials and that this machine can reach the
              MySQL server.
            </p>
          </CardBody>
        </Card>
      )}

      {snapshot.configured && !snapshot.connectionError && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Players tracked
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {snapshot.stats.totalPlayers ?? "N/A"}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Banned players
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {snapshot.stats.bannedPlayers ?? "N/A"}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody className="py-3 text-xs text-muted-foreground">
              {snapshot.playerCapabilities
                ? `Players table: ${snapshot.playerCapabilities.tableName}`
                : "Players table was not detected from the current schema."}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                Player management
              </CardTitle>
              <form className="flex items-center gap-2" action="/staff-tools/players" method="get">
                <Input
                  name="playerQ"
                  defaultValue={playerQ}
                  placeholder="Search by name, ID, or char info"
                  className="h-8 w-64 text-xs"
                />
                <Button size="sm" variant="outline" type="submit">
                  Search
                </Button>
              </form>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                    <tr>
                      <th className="px-4 py-2">Player</th>
                      <th className="px-4 py-2">Identifier</th>
                      <th className="px-4 py-2">CharInfo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.players.map((player) => [
                        <tr key={`summary-${player.identifier}`} className="border-b border-border hover:bg-muted/40">
                          <td className="px-4 py-3 font-medium text-foreground">{player.displayName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {player.identifier}
                          </td>
                          <td className="px-4 py-3">
                            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-2 text-[11px] text-muted-foreground">
                              {formatCharInfo(player.charInfo)}
                            </pre>
                          </td>
                        </tr>
                        ,
                        <tr key={`details-${player.identifier}`} className="border-b border-border">
                          <td colSpan={3} className="px-4 pb-3">
                            <details className="rounded-md border border-border bg-surface">
                              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
                                View full database row
                              </summary>
                              <div className="border-t border-border px-3 py-2">
                                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                  <Badge tone={player.banned ? "danger" : "neutral"}>
                                    {boolLabel(player.banned, "Banned", "Not banned")}
                                  </Badge>
                                  <Badge tone={player.whitelisted ? "success" : "neutral"}>
                                    {boolLabel(player.whitelisted, "Whitelisted", "Not whitelisted")}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Job: {player.job || "N/A"}
                                  </span>
                                </div>
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-2 text-[11px] text-muted-foreground">
                                  {formatFullRow(player.fullRow)}
                                </pre>
                                {(snapshot.playerCapabilities?.bannedColumn ||
                                  snapshot.playerCapabilities?.whitelistedColumn) && (
                                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                                    {snapshot.playerCapabilities?.bannedColumn && (
                                      <form action={togglePlayerBanAction}>
                                        <input type="hidden" name="playerIdentifier" value={player.identifier} />
                                        <Button type="submit" size="xs" variant="outline">
                                          Toggle ban
                                        </Button>
                                      </form>
                                    )}
                                    {snapshot.playerCapabilities?.whitelistedColumn && (
                                      <form action={togglePlayerWhitelistAction}>
                                        <input type="hidden" name="playerIdentifier" value={player.identifier} />
                                        <Button type="submit" size="xs" variant="outline">
                                          Toggle whitelist
                                        </Button>
                                      </form>
                                    )}
                                  </div>
                                )}
                              </div>
                            </details>
                          </td>
                        </tr>
                      ])}
                  </tbody>
                </table>
              </div>
              {snapshot.players.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No players found for your current search.
                </p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
