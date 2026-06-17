import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { auth } from "@/../auth";
import { Card, CardBody } from "@/components/ui/Card";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import {
  canAccessAnyStaffTool,
  getPermissionContext,
} from "@/lib/permissions";
import { discordSignInUrl } from "@/lib/auth-urls";

export default async function StaffToolsIndexPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl("/staff-tools"));
  }

  const permissions = await getPermissionContext(session.user.id);
  if (canAccessAnyStaffTool(permissions)) redirect("/staff-tools/dashboard");

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
