import { Users, Mail, ShieldAlert, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { addProjectMember } from "@/app/actions";
import { ManageMemberActions } from "./components/ManageMemberActions";

export default async function MembersPage() {
    const projectMembers = await (db as any).projectMember.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const accounts = await db.account.findMany({
        where: { provider: 'discord' },
        include: { user: true }
    });

    const enrichedMembers = projectMembers.map((member: any) => {
        const matchingAccount = accounts.find((a: any) => a.providerAccountId === member.discordId);
        if (matchingAccount) {
            return {
                ...member,
                user: matchingAccount.user,
                status: "Active"
            };
        }
        return {
            ...member,
            user: null,
            status: "Pending join"
        };
    });

    return (
        <div className="gta-page max-w-[1200px]">
            <div className="gta-hero flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 text-primary rounded-lg border border-primary/30">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="gta-heading text-3xl">Crew Roster</h1>
                        <p className="gta-subheading mt-1">
                            Manage your team members and their roles.
                        </p>
                    </div>
                </div>

                <form action={addProjectMember} className="flex gap-2">
                    <input
                        name="discordId"
                        placeholder="Discord ID..."
                        className="h-10 px-3 rounded-md text-sm border border-input bg-background focus:outline-none focus:border-primary"
                        required
                    />
                    <button type="submit" className="gta-action">
                        <Plus className="h-4 w-4" />
                        Add Member
                    </button>
                </form>
            </div>

            <div className="gta-surface">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 border-b text-muted-foreground text-xs uppercase tracking-wider [&>tr>th:first-child]:rounded-tl-xl [&>tr>th:last-child]:rounded-tr-xl">
                        <tr>
                            <th className="px-6 py-4 font-medium">Member</th>
                            <th className="px-6 py-4 font-medium">Discord ID</th>
                            <th className="px-6 py-4 font-medium">Role</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {enrichedMembers.map((member: any) => (
                            <tr key={member.id} className="hover:bg-muted/30 transition-colors last:[&>td:first-child]:rounded-bl-xl last:[&>td:last-child]:rounded-br-xl">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        {member.user?.image ? (
                                            <img src={member.user.image} alt={member.user.name || "Member"} className="w-8 h-8 rounded-full border bg-background object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full border bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                                                {member.user?.name ? member.user.name.charAt(0).toUpperCase() : "?"}
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium text-foreground">{member.user?.name || "Pending..."}</div>
                                            {member.user?.email && (
                                                <div className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                                                    <Mail className="h-3 w-3" />
                                                    {member.user.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                                    {member.discordId}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        {member.role === "Admin" && <ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                                        <span className="font-medium">{member.role}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${member.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                        'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                                        }`}>
                                        {member.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ManageMemberActions memberId={member.id} currentRole={member.role} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {enrichedMembers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No members found. Invite some team members to get started!
                    </div>
                )}
            </div>
        </div>
    );
}
