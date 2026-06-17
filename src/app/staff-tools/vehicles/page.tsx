import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Car, Coins, RefreshCcw, Shield, Users } from "lucide-react";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  canManageStaffVehicles,
  canRefreshStaffSchema,
  canViewStaffEconomy,
  canViewStaffPlayers,
  canViewStaffVehicles,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { getStaffToolsSnapshot } from "@/lib/fivem-db";
import { discordSignInUrl } from "@/lib/auth-urls";
import { putAwayVehicleAction, refreshStaffSchemaAction, toggleVehicleStorageAction } from "../actions";

function boolLabel(value: boolean | null, trueLabel: string, falseLabel: string) {
  if (value === true) return trueLabel;
  if (value === false) return falseLabel;
  return "N/A";
}

export default async function StaffVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleQ?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl("/staff-tools/vehicles"));
  }

  const permissions = await getPermissionContext(session.user.id);
  const canManageVehicles = canManageStaffVehicles(permissions);
  const canRefreshSchema = canRefreshStaffSchema(permissions);
  const showPlayersLink = canViewStaffPlayers(permissions);
  const showEconomyLink = canViewStaffEconomy(permissions);
  const denied = requirePermission(
    canViewStaffVehicles(permissions),
    "You do not have permission to access vehicle staff tools."
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
  const vehicleQ = (params.vehicleQ || "").trim();

  const snapshot = await getStaffToolsSnapshot({
    vehicleSearch: vehicleQ,
    limit: 80,
  });
  const canPutAwayVehicle = Boolean(
    canManageVehicles &&
    snapshot.vehicleCapabilities?.garageColumn &&
      (snapshot.vehicleCapabilities.storedColumn || snapshot.vehicleCapabilities.stateColumn)
  );

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Staff tools · Vehicles"
        description="Manage vehicle records in the game database."
        icon={<Car className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff-tools/dashboard"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            {showPlayersLink && (
              <Link
                href="/staff-tools/players"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
              >
                <Users className="h-3.5 w-3.5" />
                Players
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
                  Vehicles tracked
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {snapshot.stats.totalVehicles ?? "N/A"}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Player rows detected
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {snapshot.stats.totalPlayers ?? "N/A"}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody className="py-3 text-xs text-muted-foreground">
              {snapshot.vehicleCapabilities
                ? `Vehicles table: ${snapshot.vehicleCapabilities.tableName}`
                : "Vehicles table was not detected from the current schema."}
            </CardBody>
          </Card>

          {canManageVehicles && snapshot.vehicleCapabilities && !canPutAwayVehicle && (
            <Card className="border-warning/30">
              <CardBody className="py-3 text-xs text-muted-foreground">
                Garage put-away needs both a garage column and a stored/state column on the detected
                vehicle table. Refresh schema after adding those fields.
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-warning" />
                Vehicle management
              </CardTitle>
              <form className="flex items-center gap-2" action="/staff-tools/vehicles" method="get">
                <Input
                  name="vehicleQ"
                  defaultValue={vehicleQ}
                  placeholder="Search by plate, owner, or model"
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
                      <th className="px-4 py-2">Plate</th>
                      <th className="px-4 py-2">Owner</th>
                      <th className="px-4 py-2">Model</th>
                      <th className="px-4 py-2">Garage</th>
                      <th className="px-4 py-2">State</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.vehicles.map((vehicle) => (
                      <tr key={vehicle.key} className="border-b border-border hover:bg-muted/40">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {vehicle.plate || "N/A"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {vehicle.ownerIdentifier || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{vehicle.model || "Unknown"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{vehicle.garage || "N/A"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={vehicle.stored ? "success" : "warning"}>
                              {boolLabel(vehicle.stored, "Stored", "Out")}
                            </Badge>
                            <Badge tone={vehicle.impounded ? "danger" : "neutral"}>
                              {boolLabel(vehicle.impounded, "Impounded", "Not impounded")}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {canPutAwayVehicle && (
                              <form action={putAwayVehicleAction} className="flex flex-wrap justify-end gap-1.5">
                                <input type="hidden" name="vehicleKey" value={vehicle.key} />
                                <Input
                                  name="garageName"
                                  defaultValue={vehicle.garage || ""}
                                  placeholder="Garage"
                                  aria-label={`Garage for ${vehicle.plate || vehicle.key}`}
                                  className="h-7 w-32 px-2 text-xs"
                                  maxLength={100}
                                />
                                <Button type="submit" size="xs" variant="success">
                                  Put away
                                </Button>
                              </form>
                            )}
                            {canManageVehicles && (snapshot.vehicleCapabilities?.storedColumn ||
                              snapshot.vehicleCapabilities?.stateColumn) && (
                              <form action={toggleVehicleStorageAction}>
                                <input type="hidden" name="vehicleKey" value={vehicle.key} />
                                <Button type="submit" size="xs" variant="outline">
                                  Toggle stored
                                </Button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {snapshot.vehicles.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No vehicles found for your current search.
                </p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
