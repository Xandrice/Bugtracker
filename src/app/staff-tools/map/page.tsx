import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, MapPinned, Shield, Users } from "lucide-react";
import { auth } from "@/../auth";
import { StaffLiveMap } from "@/components/staff/StaffLiveMap";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { discordSignInUrl } from "@/lib/auth-urls";
import { getLiveMapSnapshot } from "@/lib/live-map";
import {
  canViewStaffPlayers,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";

export default async function StaffLiveMapPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl("/staff-tools/map"));
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
          icon={<Shield className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  const snapshot = getLiveMapSnapshot();

  return (
    <PageContainer className="max-w-[1400px]">
      <PageHeader
        title="Staff tools · Map"
        description="Live player markers from a FiveM or Renny publisher. This page never invents coordinates."
        icon={<MapPinned className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff-tools/dashboard"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <Link
              href="/staff-tools/players"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-border-strong"
            >
              <Users className="h-3.5 w-3.5" />
              Players
            </Link>
          </div>
        }
      />

      <Card className="border-warning/30">
        <CardHeader>
          <CardTitle>Server publisher required</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-muted-foreground">
          <p>
            Presence in staff tools today is playtime / first-last seen from the FiveM MySQL
            helpers. There is no live XYZ in this repo.
          </p>
          <p>
            A game server or Renny process must <code>POST /api/staff-tools/live-map</code> with{" "}
            <code>x-discord-webhook-secret</code>. Staff read current markers via{" "}
            <code>GET /api/staff-tools/live-map</code>. Ingest is held in process memory only —
            Vercel instances do not share it, and this draft adds no Prisma model.
          </p>
        </CardBody>
      </Card>

      <StaffLiveMap initialSnapshot={snapshot} />
    </PageContainer>
  );
}
