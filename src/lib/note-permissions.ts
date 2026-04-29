import { db } from "@/lib/db";

const ADMIN_LIKE_ROLES = new Set(["Admin", "Moderator", "Owner"]);

export type NotePermissionContext = {
  userId: string;
  role: string | null;
  isAdminLike: boolean;
};

export async function getNotePermissionContext(
  userId: string | null | undefined
): Promise<NotePermissionContext | null> {
  if (!userId) return null;

  // Local dev auto-auth users usually do not have Discord linkage.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_AUTO_AUTH !== "false") {
    return {
      userId,
      role: "Admin",
      isAdminLike: true,
    };
  }

  const discordAccount = await db.account.findFirst({
    where: {
      userId,
      provider: "discord",
    },
    select: { providerAccountId: true },
  });

  if (!discordAccount?.providerAccountId) {
    return {
      userId,
      role: null,
      isAdminLike: false,
    };
  }

  const member = await db.projectMember.findUnique({
    where: { discordId: discordAccount.providerAccountId },
    select: { role: true },
  });

  const role = member?.role ?? null;
  return {
    userId,
    role,
    isAdminLike: role ? ADMIN_LIKE_ROLES.has(role) : false,
  };
}

export function canManageNote(
  context: NotePermissionContext | null,
  authorId: string
): boolean {
  if (!context) return false;
  return context.isAdminLike || context.userId === authorId;
}
