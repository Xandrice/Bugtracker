import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Car,
  Coins,
  Fingerprint,
  Gavel,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataList, DataValue } from "@/components/staff/DataList";
import {
  canManageStaffPlayers,
  canViewStaffPlayers,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { getStaffPlayerDetail } from "@/lib/fivem-db";
import { discordSignInUrl } from "@/lib/auth-urls";
import { togglePlayerBanAction, togglePlayerWhitelistAction } from "../../actions";

function boolBadge(value: boolean | null, trueLabel: string, falseLabel: string, trueTone: "danger" | "success" | "warning") {
  if (value === true) return <Badge tone={trueTone}>{trueLabel}</Badge>;
  if (value === false) return <Badge tone="neutral">{falseLabel}</Badge>;
  return null;
}

export default async function StaffPlayerDetailPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier: rawIdentifier } = await params;
  const identifier = decodeURIComponent(rawIdentifier);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl(`/staff-tools/players/${rawIdentifier}`));
  }

  const permissions = await getPermissionContext(session.user.id);
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
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  const canManage = canManageStaffPlayers(permissions);
  const player = await getStaffPlayerDetail(identifier);
  if (!player) notFound();

  return (
    <PageContainer className="max-w-[1200px]">
      <Link
        href="/staff-tools/players"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to players
      </Link>

      <PageHeader
        title={player.displayName}
        description={`Citizen ID ${player.identifier}`}
        icon={<User className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {boolBadge(player.banned, "Banned", "Not banned", "danger")}
            {boolBadge(player.whitelisted, "Whitelisted", "Not whitelisted", "success")}
            {player.hasWarrant && <Badge tone="warning">Active warrant</Badge>}
            {player.isDead === true && <Badge tone="danger">Dead</Badge>}
            {player.jobLabel && <Badge tone="info">{player.jobLabel}</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Identity
            </CardTitle>
          </CardHeader>
          <CardBody>
            <DataList items={player.identity} emptyLabel="No character information stored." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Money
            </CardTitle>
          </CardHeader>
          <CardBody>
            <DataList items={player.money} emptyLabel="No economy data stored." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Job & Gang
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Job
              </p>
              <DataList items={player.job} emptyLabel="Unemployed." />
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gang
              </p>
              <DataList items={player.gang} emptyLabel="No gang affiliation." />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-primary" />
              Character details
            </CardTitle>
          </CardHeader>
          <CardBody>
            <DataList items={player.character} emptyLabel="No metadata stored." />
          </CardBody>
        </Card>
      </div>

      {player.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {player.skills.map((skill) => (
                <div key={skill.name} className="rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-sm font-medium text-foreground">{skill.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Level {skill.level ?? "?"}
                  </p>
                  {skill.xp != null && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">{skill.xp} XP</p>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {player.groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Groups
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {player.groups.map((group) => (
                <Badge key={`${group.type}-${group.group}`} tone="neutral">
                  {group.group} · {group.type}
                  {group.grade != null ? ` (${group.grade})` : ""}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            Vehicles
            <span className="text-xs font-normal text-muted-foreground">
              ({player.vehicles.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          {player.vehicles.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {player.vehicles.map((vehicle) => (
                <div key={vehicle.key} className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-medium text-foreground">
                        {vehicle.plate || vehicle.key}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {vehicle.model || "Unknown model"}
                      </p>
                    </div>
                    {vehicle.stored != null && (
                      <Badge tone={vehicle.stored ? "success" : "warning"}>
                        {vehicle.stored ? "Stored" : "Out"}
                      </Badge>
                    )}
                  </div>
                  {vehicle.garage && (
                    <p className="mt-2 text-[11px] text-muted-foreground">Garage: {vehicle.garage}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No vehicles registered to this player.</p>
          )}
        </CardBody>
      </Card>

      {player.criminal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              Criminal record
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={player.criminal.hasWarrant ? "warning" : "neutral"}>
                {player.criminal.hasWarrant ? "Active warrant" : "No warrant"}
              </Badge>
            </div>
            {player.criminal.mugshot && (
              <Image
                src={player.criminal.mugshot}
                alt={`${player.displayName} mugshot`}
                width={160}
                height={160}
                unoptimized
                className="rounded-md border border-border object-cover"
              />
            )}
            {player.criminal.notes && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground">{player.criminal.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {player.bans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-danger" />
              Ban history
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {player.bans.map((ban, index) => (
              <div key={index} className="rounded-md border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {ban.reason || "No reason provided"}
                  </p>
                  <Badge tone={ban.active ? "danger" : "neutral"}>
                    {ban.active ? "Active" : "Expired"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ban.bannedBy ? `By ${ban.bannedBy} · ` : ""}
                  Expires: {ban.expireLabel}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {canManage && (player.supportsBanToggle || player.supportsWhitelistToggle) && (
        <Card>
          <CardHeader>
            <CardTitle>Management actions</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {player.supportsBanToggle && (
              <form action={togglePlayerBanAction}>
                <input type="hidden" name="playerIdentifier" value={player.identifier} />
                <Button type="submit" size="sm" variant="outline">
                  Toggle ban
                </Button>
              </form>
            )}
            {player.supportsWhitelistToggle && (
              <form action={togglePlayerWhitelistAction}>
                <input type="hidden" name="playerIdentifier" value={player.identifier} />
                <Button type="submit" size="sm" variant="outline">
                  Toggle whitelist
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      <details className="rounded-md border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-foreground">
          Raw database row
        </summary>
        <div className="border-t border-border p-4">
          <DataValue value={player.raw} />
        </div>
      </details>
    </PageContainer>
  );
}
