import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { canManageMembers, getPermissionContext, legacyStaffPermissionsForRole, type ProjectRole } from "@/lib/permissions";
import { normalizeStaffPanelPermissions } from "@/lib/staff-permissions";
import { SettingsClient, type SettingsStaffRole } from "./SettingsClient";

export default async function SettingsPage() {
    const session = await auth();
    const permissions = await getPermissionContext(session?.user?.id);
    const canManagePermissions = canManageMembers(permissions);
    const staffRoles = canManagePermissions
        ? ((await db.staffRole.findMany({
              orderBy: [{ isSystem: "desc" }, { name: "asc" }],
          })).map(role => ({ ...role, permissions: normalizeStaffPanelPermissions(role.permissions, legacyStaffPermissionsForRole(role.baseRole as ProjectRole)) })) as SettingsStaffRole[])
        : [];

    return (
        <SettingsClient
            canManagePermissions={canManagePermissions}
            staffRoles={staffRoles}
        />
    );
}
