import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { canManageMembers, getPermissionContext } from "@/lib/permissions";
import { SettingsClient, type SettingsStaffRole } from "./SettingsClient";

export default async function SettingsPage() {
    const session = await auth();
    const permissions = await getPermissionContext(session?.user?.id);
    const canManagePermissions = canManageMembers(permissions);
    const staffRoles = canManagePermissions
        ? ((await db.staffRole.findMany({
              orderBy: [{ isSystem: "desc" }, { name: "asc" }],
          })) as SettingsStaffRole[])
        : [];

    return (
        <SettingsClient
            canManagePermissions={canManagePermissions}
            staffRoles={staffRoles}
        />
    );
}
