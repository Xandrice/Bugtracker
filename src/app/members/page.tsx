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
import { syncProjectMemberProfiles } from "@/lib/member-profiles";
import {
    formatMemberActivityLabel,
    getMemberActivityStatus,
} from "@/lib/time";

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
    discordDisplayName: string | null;
    discordAvatar: string | null;
    profileSyncedAt: Date | null;
};

type EnrichedMember = MemberRow & {
    user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
        lastSeenAt: Date | null;
    } | null;
    displayName: string | null;
    displayImage: string | null;
    lastSeenAt: Date | null;
    status: "Active" | "Pending";
    activityStatus: ReturnType<typeof getMemberActivityStatus>;
    activityLabel: string;
};

function activityTone(status: EnrichedMember["activityStatus"]) {
    if (status === "active") return "success" as const;
    if (status === "recent") return "info" as const;
    return "neutral" as const;
}

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
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    lastSeenAt: true,
                },
            },
        },
    });

    const accountByDiscordId = new Map(
        accounts.map((account) => [account.providerAccountId, account])
    );
    const lastSeenByUserId = new Map(
        accounts.map((account) => [account.userId, account.user.lastSeenAt])
    );

    const profileInputs = projectMembers.map((member) => {
        const account = accountByDiscordId.get(member.discordId);
        return {
            id: member.id,
            discordId: member.discordId,
            discordDisplayName: member.discordDisplayName,
            discordAvatar: member.discordAvatar,
            profileSyncedAt: member.profileSyncedAt,
            userId: account?.userId ?? null,
            userImage: account?.user.image ?? null,
        };
    });

    const syncedProfiles = await syncProjectMemberProfiles(profileInputs, lastSeenByUserId, {
        force: true,
    });

    const enrichedMembers: EnrichedMember[] = projectMembers.map((member) => {
        const matchingAccount = accountByDiscordId.get(member.discordId);
        const synced = syncedProfiles.get(member.discordId);
        const user = matchingAccount?.user ?? null;
        const lastSeenAt = user?.lastSeenAt ?? null;
        const activityStatus = getMemberActivityStatus(lastSeenAt);

        return {
            ...member,
            user,
            displayName: user?.name || synced?.name || member.discordDisplayName,
            displayImage: user?.image || synced?.image || member.discordAvatar,
            lastSeenAt,
            status: user ? "Active" : "Pending",
            activityStatus,
            activityLabel: formatMemberActivityLabel(lastSeenAt),
        };
    });

    enrichedMembers.sort((a, b) => {
        const rank = { active: 0, recent: 1, inactive: 2 };
        const byActivity = rank[a.activityStatus] - rank[b.activityStatus];
        if (byActivity !== 0) return byActivity;
        const aTime = a.lastSeenAt?.getTime() ?? 0;
        const bTime = b.lastSeenAt?.getTime() ?? 0;
        return bTime - aTime;
    });

    const activeCount = enrichedMembers.filter((member) => member.activityStatus === "active").length;
    const recentCount = enrichedMembers.filter((member) => member.activityStatus === "recent").length;

    return (
        <PageContainer className="max-w-[1200px]">
            <PageHeader
                title="Members"
                description="Manage your team members, roles, and recent dashboard activity."
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

            <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge tone="success">{activeCount} active now</Badge>
                <Badge tone="info">{recentCount} active today</Badge>
                <span className="self-center">
                    Activity is based on dashboard use (updated about every 10 minutes while signed in).
                </span>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-surface">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                        <tr>
                            <th className="px-4 py-2 font-medium">Member</th>
                            <th className="px-4 py-2 font-medium">Discord ID</th>
                            <th className="px-4 py-2 font-medium">Last seen</th>
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
                                                src={member.displayImage}
                                                name={member.displayName}
                                                size="md"
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-foreground">
                                                    {member.displayName || "Pending…"}
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
                                        <div className="flex flex-col gap-1">
                                            <Badge tone={activityTone(member.activityStatus)}>
                                                {member.activityLabel}
                                            </Badge>
                                            {member.lastSeenAt && member.activityStatus !== "active" && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {member.lastSeenAt.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
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
