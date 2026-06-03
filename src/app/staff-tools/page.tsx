import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { auth } from "@/../auth";
import { Card, CardBody } from "@/components/ui/Card";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import {
  canViewStaffEconomy,
  canViewStaffPlayers,
  canViewStaffVehicles,
  getPermissionContext,
} from "@/lib/permissions";

export default async function StaffToolsIndexPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/staff-tools");
  }

  const permissions = await getPermissionContext(session.user.id);
  if (canViewStaffPlayers(permissions)) redirect("/staff-tools/players");
  if (canViewStaffVehicles(permissions)) redirect("/staff-tools/vehicles");
  if (canViewStaffEconomy(permissions)) redirect("/staff-tools/economy");

  return (
    <PageContainer>
      <PageHeader
        title="Staff tools"
        description="Access is limited by your staff permissions."
        icon={<Shield className="h-4 w-4" />}
      />
      <Card className="border-danger/30">
        <CardBody className="text-sm text-danger">
          You do not have permission to access any staff tools.
        </CardBody>
      </Card>
    </PageContainer>
  );
}
