import { Users, Mail, ShieldAlert, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { addProjectMember } from "@/app/actions";
import { ManageMemberActions } from "./components/ManageMemberActions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

export default async function MembersPage() {
    const projectMembers = await (db as any).projectMember.findMany({
        orderBy: { createdAt: "desc" },
    });

    const accounts = await db.account.findMany({
        where: { provider: "discord" },
        include: { user: true },
    });

    const enrichedMembers = projectMembers.map((member: any) => {
        const matchingAccount = accounts.find((a: any) => a.providerAccountId === member.discordId);
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
                }
            />

            <div className="overflow-hidden rounded-md border border-border bg-surface">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                        <tr>
                            <th className="px-4 py-2 font-medium">Member</th>
                            <th className="px-4 py-2 font-medium">Discord ID</th>
                            <th className="px-4 py-2 font-medium">Role</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {enrichedMembers.map((member: any) => (
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
                                    <Badge tone={member.status === "Active" ? "success" : "warning"}>
                                        {member.status}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <ManageMemberActions
                                        memberId={member.id}
                                        currentRole={member.role}
                                    />
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
