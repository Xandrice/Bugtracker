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
  canManageStaffPlayers,
  canRefreshStaffSchema,
  canViewStaffEconomy,
  canViewStaffPlayers,
  canViewStaffVehicles,
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

function formatMoney(value: number | null): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function playerProfileHref(playerQ: string, identifier: string): string {
  const params = new URLSearchParams();
  if (playerQ) params.set("playerQ", playerQ);
  params.set("player", identifier);
  return `/staff-tools/players?${params.toString()}`;
}

export default async function StaffPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ playerQ?: string; player?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/staff-tools/players");
  }

  const permissions = await getPermissionContext(session.user.id);
  const canManagePlayers = canManageStaffPlayers(permissions);
  const canRefreshSchema = canRefreshStaffSchema(permissions);
  const showVehiclesLink = canViewStaffVehicles(permissions);
  const showEconomyLink = canViewStaffEconomy(permissions);
  const denied = requirePermission(
    canViewStaffPlayers(permissions),
    "You do not have permission to access player staff tools."
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
  const selectedPlayerIdentifier = (params.player || "").trim();

  const snapshot = await getStaffToolsSnapshot({
    playerSearch: playerQ,
    selectedPlayerIdentifier,
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
            {showVehiclesLink && (
              <Link
                href="/staff-tools/vehicles"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
              >
                <Car className="h-3.5 w-3.5" />
                Vehicles
              </Link>
            )}
            {showEconomyLink && (
              <Link
                href="/staff-tools/economy"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
              >
                <Coins className="h-3.5 w-3.5" />
                Economy
              </Link>
            )}
            {canRefreshSchema && (
              <form action={refreshStaffSchemaAction}>
                <Button type="submit" variant="outline" size="sm">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh schema
                </Button>
              </form>
            )}
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

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-right">Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.players.map((player) => {
                        const selected = player.identifier === selectedPlayerIdentifier;
                        return (
                          <tr
                            key={player.identifier}
                            className={`border-b border-border hover:bg-muted/40 ${
                              selected ? "bg-primary/5" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={playerProfileHref(playerQ, player.identifier)}
                                className="font-medium text-foreground hover:text-primary"
                              >
                                {player.displayName}
                              </Link>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Job: {player.job || "N/A"}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {player.identifier}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge tone={player.banned ? "danger" : "neutral"}>
                                  {boolLabel(player.banned, "Banned", "Not banned")}
                                </Badge>
                                <Badge tone={player.whitelisted ? "success" : "neutral"}>
                                  {boolLabel(player.whitelisted, "Whitelisted", "Not whitelisted")}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={playerProfileHref(playerQ, player.identifier)}
                                className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
                              >
                                {selected ? "Viewing" : "View profile"}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  Player profile
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                {!selectedPlayerIdentifier && (
                  <p className="text-sm text-muted-foreground">
                    Select a player from the list to view their staff profile.
                  </p>
                )}

                {selectedPlayerIdentifier && !snapshot.selectedPlayer && (
                  <p className="text-sm text-muted-foreground">
                    No player profile was found for the selected identifier.
                  </p>
                )}

                {snapshot.selectedPlayer && (
                  <>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {snapshot.selectedPlayer.displayName}
                      </h2>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {snapshot.selectedPlayer.identifier}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={snapshot.selectedPlayer.banned ? "danger" : "neutral"}>
                        {boolLabel(snapshot.selectedPlayer.banned, "Banned", "Not banned")}
                      </Badge>
                      <Badge tone={snapshot.selectedPlayer.whitelisted ? "success" : "neutral"}>
                        {boolLabel(snapshot.selectedPlayer.whitelisted, "Whitelisted", "Not whitelisted")}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                      <div className="rounded-md border border-border bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Job</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {snapshot.selectedPlayer.job || "N/A"}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatMoney(snapshot.selectedPlayer.cash)}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bank</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatMoney(snapshot.selectedPlayer.bank)}
                        </p>
                      </div>
                    </div>

                    {canManagePlayers && (snapshot.playerCapabilities?.bannedColumn ||
                      snapshot.playerCapabilities?.whitelistedColumn) && (
                      <div className="flex flex-wrap gap-1.5">
                        {snapshot.playerCapabilities?.bannedColumn && (
                          <form action={togglePlayerBanAction}>
                            <input
                              type="hidden"
                              name="playerIdentifier"
                              value={snapshot.selectedPlayer.identifier}
                            />
                            <Button type="submit" size="xs" variant="outline">
                              Toggle ban
                            </Button>
                          </form>
                        )}
                        {snapshot.playerCapabilities?.whitelistedColumn && (
                          <form action={togglePlayerWhitelistAction}>
                            <input
                              type="hidden"
                              name="playerIdentifier"
                              value={snapshot.selectedPlayer.identifier}
                            />
                            <Button type="submit" size="xs" variant="outline">
                              Toggle whitelist
                            </Button>
                          </form>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Vehicles
                      </h3>
                      {snapshot.selectedPlayerVehicles.length > 0 ? (
                        <div className="space-y-2">
                          {snapshot.selectedPlayerVehicles.map((vehicle) => (
                            <div key={vehicle.key} className="rounded-md border border-border bg-surface p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs font-medium text-foreground">
                                    {vehicle.plate || vehicle.key}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {vehicle.model || "Unknown model"}
                                  </p>
                                </div>
                                <Badge tone={vehicle.stored ? "success" : "warning"}>
                                  {boolLabel(vehicle.stored, "Stored", "Out")}
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Garage: {vehicle.garage || "N/A"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No vehicles were found for this player.
                        </p>
                      )}
                    </div>

                    <details className="rounded-md border border-border bg-surface">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
                        View character info
                      </summary>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap border-t border-border p-3 text-[11px] text-muted-foreground">
                        {formatCharInfo(snapshot.selectedPlayer.charInfo)}
                      </pre>
                    </details>

                    <details className="rounded-md border border-border bg-surface">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
                        View full database row
                      </summary>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-border p-3 text-[11px] text-muted-foreground">
                        {formatFullRow(snapshot.selectedPlayer.fullRow)}
                      </pre>
                    </details>
                  </>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
