import Link from "next/link";
import { redirect } from "next/navigation";
import { Car, Coins, RefreshCcw, Shield, Users } from "lucide-react";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  canAccessStaffTools,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { getStaffToolsSnapshot } from "@/lib/fivem-db";
import { refreshStaffSchemaAction } from "../actions";

function formatCurrency(value: number | null): string {
  if (value == null) return "N/A";
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export default async function StaffEconomyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/staff-tools/economy");
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

  const snapshot = await getStaffToolsSnapshot({ limit: 1, includeEconomy: true });

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Staff tools · Economy"
        description="Server-wide money totals across player accounts."
        icon={<Coins className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff-tools/players"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <Users className="h-3.5 w-3.5" />
              Players
            </Link>
            <Link
              href="/staff-tools/vehicles"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <Car className="h-3.5 w-3.5" />
              Vehicles
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

      {snapshot.configured && !snapshot.connectionError && !snapshot.economy && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle>Economy data unavailable</CardTitle>
          </CardHeader>
          <CardBody className="text-sm text-muted-foreground">
            Could not detect usable money columns in your player table.
          </CardBody>
        </Card>
      )}

      {snapshot.configured && !snapshot.connectionError && snapshot.economy && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total cash
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(snapshot.economy.totalCash)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total bank
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(snapshot.economy.totalBank)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total known money
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(snapshot.economy.totalKnownMoney)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Rows analyzed
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {snapshot.economy.rowsAnalyzed}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody className="py-3 text-xs text-muted-foreground">
              Source table: {snapshot.economy.tableName}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Other account totals</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                    <tr>
                      <th className="px-4 py-2">Account</th>
                      <th className="px-4 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(snapshot.economy.accountTotals).map(([account, amount]) => (
                      <tr key={account} className="border-b border-border hover:bg-muted/40">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{account}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Object.keys(snapshot.economy.accountTotals).length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No additional account buckets detected.
                </p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
