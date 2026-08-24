import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Car,
  Clock,
  Coins,
  ExternalLink,
  FileText,
  Fingerprint,
  Gavel,
  History,
  MessageSquare,
  Package,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DataList, DataValue } from "@/components/staff/DataList";
import {
  canManageCompensation,
  canManageStaffPlayers,
  canViewStaffPlayers,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { getStaffPlayerDetail } from "@/lib/fivem-db";
import {
  getStaffPlayerInventory,
  type StaffInventoryContainer,
  type StaffInventoryItem,
} from "@/lib/fivem-inventory";
import { listPlayerStaffAuditEvents } from "@/lib/staff-audit";
import { discordSignInUrl } from "@/lib/auth-urls";
import { StaffAuditList } from "@/components/staff/StaffAuditList";
import { togglePlayerBanAction, togglePlayerWhitelistAction } from "../../actions";
import {
  compensationItemsFromJson,
  compensationStatusLabel,
  compensationStatusTone,
  formatMoneyAmount,
} from "@/lib/compensation";

function boolBadge(value: boolean | null, trueLabel: string, falseLabel: string, trueTone: "danger" | "success" | "warning") {
  if (value === true) return <Badge tone={trueTone}>{trueLabel}</Badge>;
  if (value === false) return <Badge tone="neutral">{falseLabel}</Badge>;
  return null;
}

function InventoryItemRow({ item }: { item: StaffInventoryItem }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{item.label || item.name}</p>
        {item.label && <p className="font-mono text-[11px] text-muted-foreground">{item.name}</p>}
        {item.details.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{item.details.join(" · ")}</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">×{item.count}</span>
    </div>
  );
}

function InventorySection({
  title,
  containers,
  emptyLabel,
}: {
  title: string;
  containers: StaffInventoryContainer[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {containers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {containers.map((container) => (
            <div key={container.id} className="rounded-md border border-border bg-surface-2 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{container.title}</p>
                  {container.subtitle && (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {container.subtitle}
                    </p>
                  )}
                </div>
                <Badge tone="neutral">
                  {container.totalItems} {container.totalItems === 1 ? "item" : "items"}
                </Badge>
              </div>
              {container.items.length > 0 ? (
                <div>
                  {container.items.map((item, index) => (
                    <InventoryItemRow
                      key={`${container.id}-${item.slot ?? "x"}-${item.name}-${index}`}
                      item={item}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing stored.</p>
              )}
              {container.capped && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Showing first {container.items.length} of {container.totalItems} items.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const canFileCompensation = canManageCompensation(permissions);
  const [player, inventory] = await Promise.all([
    getStaffPlayerDetail(identifier),
    getStaffPlayerInventory(identifier),
  ]);
  if (!player) notFound();
  const auditEvents = await listPlayerStaffAuditEvents({
    playerIdentifier: player.identifier,
    vehicleKeys: player.vehicles.map((vehicle) => vehicle.key),
    limit: 20,
  });

  const showInventory =
    !!inventory &&
    (inventory.carried != null || inventory.stashes.length > 0 || inventory.vehicles.length > 0);

  // Fetch Discord account info if we have a Discord ID
  let discordAccount: { name: string | null; email: string | null; image: string | null } | null = null;
  if (player.discordId) {
    const account = await db.account.findFirst({
      where: { provider: "discord", providerAccountId: player.discordId },
      include: { user: true },
    });
    if (account?.user) {
      discordAccount = {
        name: account.user.name,
        email: account.user.email,
        image: account.user.image,
      };
    }
  }

  // Fetch related mod-log entries (PlayerReports), including Discord intake.
  // Match the bare snowflake and a `discord:` prefix so bot/FiveM formats both attach.
  const subjectDiscordIds = player.discordId
    ? Array.from(
        new Set(
          [
            player.discordId,
            player.discordId.replace(/^discord:/i, ""),
            player.discordId.startsWith("discord:")
              ? player.discordId
              : `discord:${player.discordId}`,
          ].filter(Boolean)
        )
      )
    : [];
  const modLogEntries = subjectDiscordIds.length
    ? await db.playerReport.findMany({
        where: { subjectDiscordId: { in: subjectDiscordIds } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          reporter: { select: { name: true } },
          assignee: { select: { name: true } },
          linkedIssues: {
            include: {
              issue: {
                select: { id: true, publicKey: true, title: true },
              },
            },
          },
        },
      })
    : [];

  const compensationRequests = await db.compensationRequest.findMany({
    where: {
      OR: [
        { playerIdentifier: player.identifier },
        ...(player.discordId ? [{ discordId: player.discordId }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      requester: { select: { name: true } },
      resolver: { select: { name: true } },
      payer: { select: { name: true } },
    },
  });

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
        {player.presence.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Presence
              </CardTitle>
            </CardHeader>
            <CardBody>
              <DataList items={player.presence} emptyLabel="No presence data stored." />
            </CardBody>
          </Card>
        )}

        {player.discordId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Discord Identity
              </CardTitle>
            </CardHeader>
            <CardBody>
              {discordAccount ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={discordAccount.name} src={discordAccount.image} size="md" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{discordAccount.name}</p>
                      {discordAccount.email && (
                        <p className="text-xs text-muted-foreground">{discordAccount.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-surface-2 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Discord ID
                    </p>
                    <p className="font-mono text-xs text-foreground">{player.discordId}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Discord ID found but no linked account in this dashboard.
                  </p>
                  <div className="rounded-md border border-border bg-surface-2 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Discord ID
                    </p>
                    <p className="font-mono text-xs text-foreground">{player.discordId}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}

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

      {showInventory && inventory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Inventory
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            {inventory.carried && (
              <InventorySection
                title="Carried"
                containers={[inventory.carried]}
                emptyLabel="Nothing carried."
              />
            )}
            {inventory.stashes.length > 0 && (
              <div className={inventory.carried ? "border-t border-border pt-4" : undefined}>
                <InventorySection
                  title="Stashes"
                  containers={inventory.stashes}
                  emptyLabel="No linked stashes."
                />
              </div>
            )}
            {inventory.vehicles.length > 0 && (
              <div
                className={
                  inventory.carried || inventory.stashes.length > 0
                    ? "border-t border-border pt-4"
                    : undefined
                }
              >
                <InventorySection
                  title="Vehicle trunks & gloveboxes"
                  containers={inventory.vehicles}
                  emptyLabel="No trunk or glovebox items."
                />
              </div>
            )}
          </CardBody>
        </Card>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              Compensation
              <span className="text-xs font-normal text-muted-foreground">
                ({compensationRequests.length})
              </span>
            </span>
            <span className="flex items-center gap-2">
              {canFileCompensation && (
                <Link
                  href={`/staff-tools/compensation/new?identifier=${encodeURIComponent(player.identifier)}${
                    player.displayName ? `&name=${encodeURIComponent(player.displayName)}` : ""
                  }${player.discordId ? `&discordId=${encodeURIComponent(player.discordId)}` : ""}`}
                  className="text-xs font-medium text-primary hover:text-primary/80"
                >
                  File request
                </Link>
              )}
              <Link
                href="/staff-tools/compensation"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                Queue
                <ExternalLink className="h-3 w-3" />
              </Link>
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {compensationRequests.length > 0 ? (
            compensationRequests.map((request) => {
              const items = compensationItemsFromJson(request.items);
              return (
                <Link
                  key={request.id}
                  href={`/staff-tools/compensation/${request.id}`}
                  className="block rounded-md border border-border bg-surface-2 p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{request.reason}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {request.cashAmount != null && <span>Cash {formatMoneyAmount(request.cashAmount)}</span>}
                        {request.bankAmount != null && <span>Bank {formatMoneyAmount(request.bankAmount)}</span>}
                        {items.length > 0 && (
                          <span>
                            {items.length} item{items.length === 1 ? "" : "s"}
                          </span>
                        )}
                        <span>By {request.requester?.name || "Staff"}</span>
                        <span>{new Date(request.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge tone={compensationStatusTone(request.status)}>
                      {compensationStatusLabel(request.status)}
                    </Badge>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">No compensation requests for this player.</p>
          )}
        </CardBody>
      </Card>

      {modLogEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Mod Log
                <span className="text-xs font-normal text-muted-foreground">
                  ({modLogEntries.length})
                </span>
              </span>
              <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                View all
                <ExternalLink className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {modLogEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/reports/${entry.id}`}
                className="block rounded-md border border-border bg-surface-2 p-3 transition-colors hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{entry.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Category: {entry.category}</span>
                      <span>•</span>
                      <span>By {entry.reporter?.name || "Staff"}</span>
                      <span>•</span>
                      <span>{new Date(entry.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {entry.linkedIssues.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.linkedIssues.map((link) => (
                          <Link
                            key={link.issueId}
                            href={`/issues/${link.issue.publicKey || link.issue.id}`}
                            className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {link.issue.publicKey || `#${link.issue.id.slice(0, 8)}`}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge tone={entry.status === "CLOSED" ? "success" : "warning"}>
                    {entry.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Recent staff writes
          </CardTitle>
        </CardHeader>
        <CardBody>
          <StaffAuditList
            events={auditEvents}
            emptyLabel="No dashboard ban, whitelist, or vehicle writes for this player yet."
          />
        </CardBody>
      </Card>

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
