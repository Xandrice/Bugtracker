import Link from "next/link";
import { Banknote, Plus } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  canManageCompensation,
  canViewCompensation,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { discordSignInUrl } from "@/lib/auth-urls";
import { redirect } from "next/navigation";
import {
  COMPENSATION_STATUSES,
  compensationItemsFromJson,
  compensationStatusLabel,
  compensationStatusTone,
  formatMoneyAmount,
  isCompensationStatus,
} from "@/lib/compensation";

const FILTERS = ["ALL", ...COMPENSATION_STATUSES] as const;

export default async function CompensationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl("/staff-tools/compensation"));
  }

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canViewCompensation(permissions),
    "You do not have permission to view the compensation queue."
  );
  if (denied) {
    return (
      <PageContainer>
        <PageHeader
          title="Compensation"
          description="Access is limited to staff roles."
          icon={<Banknote className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  const canManage = canManageCompensation(permissions);
  const statusParam = ((await searchParams).status || "OPEN").trim().toUpperCase();
  const statusFilter =
    statusParam === "ALL" ? undefined : isCompensationStatus(statusParam) ? statusParam : "OPEN";

  const requests = await db.compensationRequest.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      requester: { select: { name: true } },
      assignee: { select: { name: true } },
      resolver: { select: { name: true } },
      payer: { select: { name: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Staff tools · Compensation"
        description="Queue refunds for lost items, wipes, or bug loss. Approve here; pay out in-game / txAdmin."
        icon={<Banknote className="h-4 w-4" />}
        actions={
          canManage ? (
            <Link
              href="/staff-tools/compensation/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New request
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((status) => {
          const href =
            status === "ALL"
              ? "/staff-tools/compensation?status=ALL"
              : `/staff-tools/compensation?status=${status}`;
          const active = statusFilter ? status === statusFilter : status === "ALL";
          return (
            <Link
              key={status}
              href={href}
              className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {status === "ALL" ? "All" : compensationStatusLabel(status)}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
            <tr>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Payout</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Requested by</th>
              <th className="px-4 py-2">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const items = compensationItemsFromJson(request.items);
              return (
                <tr key={request.id} className="border-b border-border hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/staff-tools/compensation/${request.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {request.playerName || request.playerIdentifier}
                    </Link>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {request.playerIdentifier}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="line-clamp-2 text-foreground">{request.reason}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div className="space-y-0.5">
                      {request.cashAmount != null && <p>Cash {formatMoneyAmount(request.cashAmount)}</p>}
                      {request.bankAmount != null && <p>Bank {formatMoneyAmount(request.bankAmount)}</p>}
                      {items.length > 0 && (
                        <p>
                          {items.length} item{items.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={compensationStatusTone(request.status)}>
                      {compensationStatusLabel(request.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{request.requester?.name || "Staff"}</td>
                  <td className="px-4 py-3 text-xs">{request.assignee?.name || "Unassigned"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {requests.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {statusFilter
              ? `No ${compensationStatusLabel(statusFilter).toLowerCase()} compensation requests.`
              : "No compensation requests yet."}
          </p>
        )}
      </div>

      {!canManage && (
        <p className="text-[11px] text-muted-foreground">
          Filing and approval require manage-player permission or an Admin / Moderator role.
        </p>
      )}
    </PageContainer>
  );
}
