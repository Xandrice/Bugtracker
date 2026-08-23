import { Banknote } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  canManageCompensation,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { discordSignInUrl } from "@/lib/auth-urls";
import { getStaffUsers } from "@/lib/staff";
import { createCompensationRequest } from "../actions";

export default async function NewCompensationRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ identifier?: string; name?: string; discordId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl("/staff-tools/compensation/new"));
  }

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canManageCompensation(permissions),
    "You do not have permission to file compensation requests."
  );
  if (denied) {
    return (
      <PageContainer className="max-w-2xl">
        <PageHeader
          title="New compensation request"
          description="Access is limited to staff who can manage players."
          icon={<Banknote className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  const params = await searchParams;
  const staffUsers = await getStaffUsers();

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="New compensation request"
        description="File a refund for lost items, a wipe, or bug loss. This does not pay the player — payout stays in-game / txAdmin."
        icon={<Banknote className="h-4 w-4" />}
      />
      <Card>
        <CardBody>
          <form action={createCompensationRequest} className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Citizen ID / identifier
              </label>
              <Input
                name="playerIdentifier"
                required
                defaultValue={params.identifier || ""}
                placeholder="citizenid or license identifier"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Character name (optional)
                </label>
                <Input
                  name="playerName"
                  defaultValue={params.name || ""}
                  placeholder="In-game name"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Discord ID (optional)
                </label>
                <Input
                  name="discordId"
                  defaultValue={params.discordId || ""}
                  inputMode="numeric"
                  placeholder="e.g. 123456789012345678"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Reason</label>
              <textarea
                name="reason"
                required
                placeholder="What was lost and why it should be refunded…"
                className="min-h-[120px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Cash amount (optional)
                </label>
                <Input name="cashAmount" inputMode="decimal" placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Bank amount (optional)
                </label>
                <Input name="bankAmount" inputMode="decimal" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Items (optional, one per line)
              </label>
              <textarea
                name="items"
                placeholder={"lockpick x3\nweapon_pistol\nbread: 5"}
                className="min-h-[80px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
              />
              <p className="mt-1 text-[11px] text-subtle-foreground">
                Formats: <code>name</code>, <code>3 x name</code>, <code>name x3</code>, or{" "}
                <code>name: 3</code>.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Evidence notes / links (optional)
              </label>
              <textarea
                name="evidence"
                placeholder="Ticket link, screenshot URLs, staff notes…"
                className="min-h-[80px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Assign to (optional)
              </label>
              <select
                name="assigneeId"
                defaultValue="none"
                className="h-8 w-full rounded-md border border-input bg-elevated px-2 text-xs"
              >
                <option value="none">Unassigned</option>
                {staffUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.id}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" size="sm">
              File request
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
