import { Mail, Plus, ShieldAlert, Users } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import {
    addProjectMember,
    assignMemberStaffRoleAction,
} from "@/app/actions";
import { ManageMemberActions } from "./components/ManageMemberActions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { canManageMembers, getPermissionContext } from "@/lib/permissions";

type StaffRoleRow = {
    id: string;
    name: string;
    baseRole: string;
    permissions: unknown;
    isSystem: boolean;
};

type MemberRow = {
    id: string;
    discordId: string;
    role: string;
    staffRoleId: string | null;
    staffRole: StaffRoleRow | null;
};

type EnrichedMember = MemberRow & {
    user: {
        name: string | null;
        email: string | null;
        image: string | null;
    } | null;
    status: "Active" | "Pending";
};

export default async function MembersPage() {
    const session = await auth();
    const permissions = await getPermissionContext(session?.user?.id);
    const canManage = canManageMembers(permissions);
    const projectMembers = await db.projectMember.findMany({
        include: { staffRole: true },
        orderBy: { createdAt: "desc" },
    }) as MemberRow[];

    const staffRoles = await db.staffRole.findMany({
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }) as StaffRoleRow[];

    const accounts = await db.account.findMany({
        where: { provider: "discord" },
        include: { user: true },
    });

    const enrichedMembers: EnrichedMember[] = projectMembers.map((member) => {
        const matchingAccount = accounts.find((account) => account.providerAccountId === member.discordId);
        if (matchingAccount) {
            return { ...member, user: matchingAccount.user, status: "Active" };
        }
        return { ...member, user: null, status: "Pending" };
    });

    return (
        <PageContainer className="max-w-[1200px]">
            <PageHeader
                title="Members"
                description="Manage your team members and their roles."
                icon={<Users className="h-4 w-4" />}
                actions={
                    canManage ? (
                        <form action={addProjectMember} className="flex gap-2">
                            <input
                                name="discordId"
                                placeholder="Discord ID…"
                                className="h-8 w-44 rounded-md border border-input bg-elevated px-2.5 text-xs text-foreground placeholder:text-subtle-foreground focus-ring transition-colors hover:border-border-strong"
                                required
                            />
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                            </button>
                        </form>
                    ) : undefined
                }
            />

            <div className="overflow-hidden rounded-md border border-border bg-surface">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                        <tr>
                            <th className="px-4 py-2 font-medium">Member</th>
                            <th className="px-4 py-2 font-medium">Discord ID</th>
                            <th className="px-4 py-2 font-medium">App Role</th>
                            <th className="px-4 py-2 font-medium">Staff Role</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {enrichedMembers.map((member) => (
                                <tr
                                    key={member.id}
                                    className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/40"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                src={member.user?.image}
                                                name={member.user?.name}
                                                size="md"
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-foreground">
                                                    {member.user?.name || "Pending…"}
                                                </div>
                                                {member.user?.email && (
                                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        {member.user.email}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                        {member.discordId}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                                            {member.role === "Admin" && (
                                                <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                                            )}
                                            {member.role}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {canManage ? (
                                            <form action={assignMemberStaffRoleAction} className="flex gap-2">
                                                <input type="hidden" name="memberId" value={member.id} />
                                                <select
                                                    name="staffRoleId"
                                                    defaultValue={member.staffRoleId || ""}
                                                    className="h-8 rounded-md border border-input bg-elevated px-2 text-xs text-foreground focus-ring"
                                                >
                                                    {staffRoles.map((role) => (
                                                        <option key={role.id} value={role.id}>
                                                            {role.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button type="submit" size="sm" variant="outline">
                                                    Assign
                                                </Button>
                                            </form>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                {member.staffRole?.name || "None"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge tone={member.status === "Active" ? "success" : "warning"}>
                                            {member.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {canManage ? (
                                            <ManageMemberActions
                                                memberId={member.id}
                                                currentRole={member.role}
                                            />
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </td>
                                </tr>
                        ))}
                    </tbody>
                </table>
                {enrichedMembers.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No members found. Invite some team members to get started.
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
