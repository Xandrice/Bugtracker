import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Banknote } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { getStaffUsers } from "@/lib/staff";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  canManageCompensation,
  canViewCompensation,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { discordSignInUrl } from "@/lib/auth-urls";
import {
  allowedCompensationTransitions,
  compensationItemsFromJson,
  compensationStatusLabel,
  compensationStatusTone,
  formatMoneyAmount,
} from "@/lib/compensation";
import { updateCompensationRequest } from "../actions";

function formatStamp(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleString() : null;
}

export default async function CompensationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl(`/staff-tools/compensation/${id}`));
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
  const staffUsers = canManage ? await getStaffUsers() : [];
  const request = await db.compensationRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { name: true } },
      assignee: { select: { name: true } },
      resolver: { select: { name: true } },
      payer: { select: { name: true } },
    },
  });
  if (!request) notFound();

  const items = compensationItemsFromJson(request.items);
  const transitions = allowedCompensationTransitions(request.status);
  const resolvedLabel = request.status === "DENIED" ? "Denied" : "Approved";

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href="/staff-tools/compensation"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </Link>

      <PageHeader
        title={request.playerName || request.playerIdentifier}
        description={request.reason}
        icon={<Banknote className="h-4 w-4" />}
        actions={
          <Badge tone={compensationStatusTone(request.status)}>
            {compensationStatusLabel(request.status)}
          </Badge>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              Identifier:{" "}
              <Link
                href={`/staff-tools/players/${encodeURIComponent(request.playerIdentifier)}`}
                className="font-mono text-foreground hover:text-primary"
              >
                {request.playerIdentifier}
              </Link>
            </p>
            {request.discordId && (
              <p>
                Discord ID: <span className="font-mono text-foreground">{request.discordId}</span>
              </p>
            )}
            <p>
              Cash: <span className="text-foreground">{formatMoneyAmount(request.cashAmount)}</span>
            </p>
            <p>
              Bank: <span className="text-foreground">{formatMoneyAmount(request.bankAmount)}</span>
            </p>
            <p>
              Requested by:{" "}
              <span className="text-foreground">{request.requester?.name || "Staff"}</span>
              {formatStamp(request.createdAt) ? ` · ${formatStamp(request.createdAt)}` : ""}
            </p>
            <p>
              Assigned: <span className="text-foreground">{request.assignee?.name || "Unassigned"}</span>
            </p>
            {(request.resolver || request.resolvedAt) && (
              <p>
                {resolvedLabel} by:{" "}
                <span className="text-foreground">{request.resolver?.name || "Staff"}</span>
                {formatStamp(request.resolvedAt) ? ` · ${formatStamp(request.resolvedAt)}` : ""}
              </p>
            )}
            {(request.payer || request.paidAt) && (
              <p>
                Marked paid by:{" "}
                <span className="text-foreground">{request.payer?.name || "Staff"}</span>
                {formatStamp(request.paidAt) ? ` · ${formatStamp(request.paidAt)}` : ""}
              </p>
            )}
          </div>

          {items.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                Items
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item, index) => (
                  <Badge key={`${item.name}-${index}`} tone="neutral">
                    {item.name}
                    {item.quantity !== 1 ? ` × ${item.quantity}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {request.evidence && (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                Evidence
              </p>
              <pre className="rounded-md border border-border bg-muted p-3 text-xs whitespace-pre-wrap">
                {request.evidence}
              </pre>
            </div>
          )}

          <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] text-muted-foreground">
            This queue does not write cash, bank, or items to the live FiveM database. After
            approval, pay the player in-game or through txAdmin, then mark the request paid.
          </p>

          {canManage && (
            <form action={updateCompensationRequest} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={request.id} />
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Status</label>
                <select
                  name="status"
                  defaultValue={request.status}
                  className="h-8 rounded-md border border-input bg-elevated px-2 text-xs"
                >
                  <option value={request.status}>{compensationStatusLabel(request.status)}</option>
                  {transitions.map((status) => (
                    <option key={status} value={status}>
                      {compensationStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Assignee</label>
                <select
                  name="assigneeId"
                  defaultValue={request.assigneeId || "none"}
                  className="h-8 rounded-md border border-input bg-elevated px-2 text-xs"
                >
                  <option value="none">Unassigned</option>
                  {staffUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.id}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" variant="primary">
                Update
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </PageContainer>
  );
}
