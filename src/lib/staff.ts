import { db } from "@/lib/db";

type StaffUser = {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
};

function sortByName(a: StaffUser, b: StaffUser) {
  return (a.name || "").localeCompare(b.name || "");
}

export async function getStaffUsers(): Promise<StaffUser[]> {
  const projectMembers = await db.projectMember.findMany({
    select: { discordId: true },
  });

  const discordIds = projectMembers.map((m) => m.discordId).filter(Boolean);
  const byId = new Map<string, StaffUser>();

  if (discordIds.length > 0) {
    const staffAccounts = await db.account.findMany({
      where: {
        provider: "discord",
        providerAccountId: { in: discordIds },
      },
      include: { user: true },
    });

    for (const account of staffAccounts) {
      if (!account.user) continue;
      byId.set(account.user.id, {
        id: account.user.id,
        name: account.user.name,
        image: account.user.image,
        discordId: account.providerAccountId,
      });
    }
  }

  // Fallback so the app still works before staff mapping is populated.
  if (byId.size === 0) {
    const users = await db.user.findMany({
      select: { id: true, name: true, image: true },
      orderBy: { name: "asc" },
    });
    return users.map((u) => ({ ...u, discordId: null }));
  }

  return Array.from(byId.values()).sort(sortByName);
}

