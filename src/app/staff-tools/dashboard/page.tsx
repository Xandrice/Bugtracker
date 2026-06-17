import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Car,
  CameraIcon,
  Coins,
  RefreshCcw,
  Shield,
  Users,
} from "lucide-react";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  canAccessAnyStaffTool,
  canRefreshStaffSchema,
  canViewStaffEconomy,
  canViewStaffPlayers,
  canViewStaffVehicles,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { getDashboardMetrics } from "@/lib/fivem-db";
import { getLatestSnapshotTime, getMetricHistory } from "@/lib/staff-snapshots";
import {
  AreaTrendPanel,
  CHART_COLORS,
  DonutPanel,
  HorizontalBarPanel,
  VerticalBarPanel,
} from "@/components/staff/charts/Charts";
import { captureSnapshotAction, refreshStaffSchemaAction } from "../actions";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardBody className="space-y-1 py-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/staff-tools/dashboard");
  }

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canAccessAnyStaffTool(permissions),
    "You do not have permission to access staff tools."
  );
  if (denied) {
    return (
      <PageContainer>
        <PageHeader
          title="Staff dashboard"
          description="Access is limited to staff roles."
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  const canRefreshSchema = canRefreshStaffSchema(permissions);
  const showPlayersLink = canViewStaffPlayers(permissions);
  const showVehiclesLink = canViewStaffVehicles(permissions);
  const showEconomyLink = canViewStaffEconomy(permissions);

  const [metrics, history, lastSnapshot] = await Promise.all([
    getDashboardMetrics(),
    getMetricHistory(30),
    getLatestSnapshotTime(),
  ]);

  const cashVsBank = [
    { name: "Cash", value: Math.round(metrics.economy.totalCash) },
    { name: "Bank", value: Math.round(metrics.economy.totalBank) },
    ...(metrics.economy.totalCrypto > 0
      ? [{ name: "Crypto", value: Math.round(metrics.economy.totalCrypto) }]
      : []),
  ];

  const dutySplit = [
    { name: "On duty", value: metrics.jobs.onDuty },
    { name: "Off duty", value: metrics.jobs.offDuty },
  ];

  const vehicleStatus = [
    { name: "Stored", value: metrics.vehicles.stored },
    { name: "Out", value: metrics.vehicles.outside },
    { name: "Impounded", value: metrics.vehicles.impounded },
  ];

  const topPlayers = metrics.economy.topPlayers.map((player) => ({
    name: player.name,
    count: Math.round(player.total),
  }));

  const trend = history.map((point) => ({
    date: new Date(point.capturedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    totalMoney: Math.round(point.totalMoney),
    totalPlayers: point.totalPlayers,
  }));

  return (
    <PageContainer className="max-w-[1400px]">
      <PageHeader
        title="Staff tools · Dashboard"
        description="Live analytics across players, economy, jobs, and vehicles."
        icon={<BarChart3 className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {showPlayersLink && (
              <Link
                href="/staff-tools/players"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
              >
                <Users className="h-3.5 w-3.5" />
                Players
              </Link>
            )}
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
            <form action={captureSnapshotAction}>
              <Button type="submit" variant="outline" size="sm">
                <CameraIcon className="h-3.5 w-3.5" />
                Capture snapshot
              </Button>
            </form>
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

      {!metrics.configured && (
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
          </CardBody>
        </Card>
      )}

      {metrics.connectionError && (
        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle>Unable to connect to FiveM database</CardTitle>
          </CardHeader>
          <CardBody className="text-sm text-danger">{metrics.connectionError}</CardBody>
        </Card>
      )}

      {metrics.configured && !metrics.connectionError && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Players"
              value={formatNumber(metrics.players.total)}
              hint={`${formatNumber(metrics.players.activeLast7d)} active this week`}
            />
            <StatCard
              label="Total money"
              value={formatCurrency(metrics.economy.total)}
              hint={`${formatCurrency(metrics.economy.totalBank)} banked`}
            />
            <StatCard
              label="Vehicles"
              value={formatNumber(metrics.vehicles.total)}
              hint={`${formatNumber(metrics.vehicles.impounded)} impounded`}
            />
            <StatCard
              label="On duty"
              value={formatNumber(metrics.jobs.onDuty)}
              hint={`${formatNumber(metrics.players.jailed)} jailed · ${formatNumber(
                metrics.players.dead
              )} dead`}
            />
          </div>

          {trend.length >= 2 && (
            <ChartCard title="Trends (last 30 days)" icon={<BarChart3 className="h-4 w-4 text-primary" />}>
              <AreaTrendPanel
                data={trend}
                xKey="date"
                series={[
                  { key: "totalMoney", label: "Total money", color: CHART_COLORS[1] },
                  { key: "totalPlayers", label: "Players", color: CHART_COLORS[0] },
                ]}
              />
            </ChartCard>
          )}

          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Economy
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Wealth distribution" icon={<Coins className="h-4 w-4 text-primary" />}>
              <VerticalBarPanel data={metrics.economy.distribution} xKey="bucket" color={CHART_COLORS[2]} />
            </ChartCard>
            <ChartCard title="Cash vs bank" icon={<Coins className="h-4 w-4 text-primary" />}>
              <DonutPanel data={cashVsBank} />
            </ChartCard>
            <ChartCard title="Wealthiest players" icon={<Coins className="h-4 w-4 text-primary" />}>
              <HorizontalBarPanel data={topPlayers} color={CHART_COLORS[1]} />
            </ChartCard>
          </div>

          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Jobs & gangs
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Players per job" icon={<Users className="h-4 w-4 text-primary" />}>
              <HorizontalBarPanel data={metrics.jobs.byJob} color={CHART_COLORS[0]} />
            </ChartCard>
            <ChartCard title="On / off duty" icon={<Users className="h-4 w-4 text-primary" />}>
              <DonutPanel data={dutySplit} />
            </ChartCard>
            <ChartCard title="Top gangs" icon={<Shield className="h-4 w-4 text-primary" />}>
              <HorizontalBarPanel data={metrics.jobs.topGangs} color={CHART_COLORS[5]} emptyLabel="No gang members." />
            </ChartCard>
          </div>

          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vehicles
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Vehicles per garage" icon={<Car className="h-4 w-4 text-primary" />}>
              <HorizontalBarPanel data={metrics.vehicles.byGarage} color={CHART_COLORS[4]} />
            </ChartCard>
            <ChartCard title="Most owned models" icon={<Car className="h-4 w-4 text-primary" />}>
              <HorizontalBarPanel data={metrics.vehicles.topModels} color={CHART_COLORS[3]} />
            </ChartCard>
            <ChartCard title="Storage status" icon={<Car className="h-4 w-4 text-primary" />}>
              <DonutPanel data={vehicleStatus} />
            </ChartCard>
          </div>

          <p className="pt-2 text-[11px] text-muted-foreground">
            Metrics generated {new Date(metrics.generatedAt).toLocaleString()}
            {lastSnapshot
              ? ` · last history snapshot ${new Date(lastSnapshot).toLocaleString()}`
              : " · no history snapshots captured yet"}
          </p>
        </>
      )}
    </PageContainer>
  );
}
