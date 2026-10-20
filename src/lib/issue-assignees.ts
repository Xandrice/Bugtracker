export type IssueAssigneeUser = { id: string; name: string | null; image?: string | null };

export const issueAssigneeInclude = {
  include: { user: { select: { id: true, name: true, image: true } } },
  orderBy: { userId: "asc" },
} as const;

export function assigneeUsers(rows: { user: IssueAssigneeUser }[]): IssueAssigneeUser[] {
  return rows.map(row => row.user);
}

export function assigneeNames(users: IssueAssigneeUser[]): string {
  return users.map(user => user.name || user.id).join(", ");
}
