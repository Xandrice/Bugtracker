import { db } from "@/lib/db";

export const PROJECT_ROLES = [
  "Owner",
  "Admin",
  "Developer",
  "Moderator",
  "Member",
] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

const ADMIN_LIKE_ROLES = new Set<ProjectRole>(["Admin", "Moderator", "Owner"]);
const ASSIGN_ROLES = new Set<ProjectRole>([
  "Owner",
  "Admin",
  "Developer",
  "Moderator",
]);
const MANAGE_ROLES = new Set<ProjectRole>(["Owner", "Admin"]);
const DEFAULT_LOG_VIEW_ROLES: ProjectRole[] = ["Owner", "Admin"];
const LOG_VIEW_ROLES = parseRoleSet(
  process.env.LOG_VIEW_ROLES,
  DEFAULT_LOG_VIEW_ROLES
);

function parseRoleSet(
  raw: string | undefined,
  fallback: ProjectRole[]
): Set<ProjectRole> {
  const validRoles = new Set<ProjectRole>(PROJECT_ROLES);
  if (!raw?.trim()) return new Set(fallback);

  const parsed = raw
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is ProjectRole => validRoles.has(role as ProjectRole));

  return parsed.length > 0 ? new Set(parsed) : new Set(fallback);
}

export type PermissionContext = {
  userId: string;
  role: ProjectRole | null;
  isAdminLike: boolean;
};

export async function getPermissionContext(
  userId: string | null | undefined
): Promise<PermissionContext | null> {
  if (!userId) return null;

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

  const role = (member?.role as ProjectRole | undefined) ?? null;
  return {
    userId,
    role,
    isAdminLike: role ? ADMIN_LIKE_ROLES.has(role) : false,
  };
}

export function hasRole(
  context: PermissionContext | null,
  roles: Set<ProjectRole>
): boolean {
  if (!context?.role) return false;
  return roles.has(context.role);
}

export function canEditIssues(context: PermissionContext | null): boolean {
  return !!context;
}

export function canAssignIssues(context: PermissionContext | null): boolean {
  return hasRole(context, ASSIGN_ROLES);
}

export function canDeleteIssues(context: PermissionContext | null): boolean {
  return hasRole(context, MANAGE_ROLES);
}

export function canManageMembers(context: PermissionContext | null): boolean {
  return hasRole(context, MANAGE_ROLES);
}

export function canAccessSettings(context: PermissionContext | null): boolean {
  return hasRole(context, MANAGE_ROLES);
}

export function canExportData(context: PermissionContext | null): boolean {
  return hasRole(context, MANAGE_ROLES);
}

export function canDeleteAllData(context: PermissionContext | null): boolean {
  return context?.role === "Owner";
}

export function canManageAnnouncements(context: PermissionContext | null): boolean {
  return hasRole(context, MANAGE_ROLES);
}

export function canManageIncidents(context: PermissionContext | null): boolean {
  return hasRole(context, new Set([...MANAGE_ROLES, "Moderator" as ProjectRole]));
}

export function canManageReleases(context: PermissionContext | null): boolean {
  return hasRole(context, new Set([...MANAGE_ROLES, "Developer" as ProjectRole]));
}

export function canManageReports(context: PermissionContext | null): boolean {
  return hasRole(context, new Set([...MANAGE_ROLES, "Moderator" as ProjectRole]));
}

export function canViewLogs(context: PermissionContext | null): boolean {
  return hasRole(context, LOG_VIEW_ROLES);
}

export function canManageNote(
  context: PermissionContext | null,
  authorId: string
): boolean {
  if (!context) return false;
  return context.isAdminLike || context.userId === authorId;
}

export function requirePermission(
  allowed: boolean,
  message = "You do not have permission to perform this action."
): { error: string } | null {
  return allowed ? null : { error: message };
}
