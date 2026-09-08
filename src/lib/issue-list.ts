import { Prisma } from "@prisma/client";
import { db } from "./db";
import { parseIssueListState, type IssueListParams, type IssueListScope, type IssueListState } from "./issue-list-state";

export type IssueListRow = {
  id: string; publicKey: string | null; title: string; status: string; type: string; priority: string; severity: string;
  assigneeId: string | null; assigneeName: string | null; dueDate: Date | null; updatedAt: Date;
  resourceName: string | null; storyPoints: number | null; parentIssueId: string | null;
  matches: boolean; childCount: number;
};
export type IssueGroup = { parent: IssueListRow; children: IssueListRow[]; expanded: boolean };
export type IssueListPage = { groups: IssueGroup[]; state: IssueListState; groupCount: number; matchingCount: number; pageCount: number; scope: IssueListScope };

// Alias/column SQL fragments are selected from constants, never from request strings.
export function issueMatchSql(state: IssueListState, scope: IssueListScope, userId: string | null, alias: "i" | "c") {
  const col = (name: string) => Prisma.raw(`${alias}."${name}"`);
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (scope === "assigned") filters.push(Prisma.sql`${col("assigneeId")} = ${userId}`);
  if (scope === "watching") filters.push(Prisma.sql`EXISTS (SELECT 1 FROM "IssueWatcher" w WHERE w."issueId" = ${col("id")} AND w."userId" = ${userId})`);
  if (scope === "triage") filters.push(Prisma.sql`${col("assigneeId")} IS NULL AND ${col("status")} = 'OPEN'`);
  if (state.status === "ACTIVE") filters.push(Prisma.sql`${col("status")} <> 'DONE'`);
  else if (state.status !== "ALL") filters.push(Prisma.sql`${col("status")} = ${state.status}`);
  if (state.type !== "ALL") filters.push(Prisma.sql`${col("type")} = ${state.type}`);
  if (state.assignee === "UNASSIGNED") filters.push(Prisma.sql`${col("assigneeId")} IS NULL`);
  else if (state.assignee !== "ALL") filters.push(Prisma.sql`${col("assigneeId")} = ${state.assignee}`);
  if (state.q) {
    const query = `%${state.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(Prisma.sql`(${col("title")} ILIKE ${query} OR COALESCE(${col("publicKey")}, ${col("id")}) ILIKE ${query})`);
  }
  return Prisma.sql`(${Prisma.join(filters, " AND ")})`;
}
function orderSql(state: IssueListState) {
  const order = {
    id: Prisma.sql`COALESCE(i."publicKey", i.id)`, title: Prisma.sql`i.title`, type: Prisma.sql`i.type`, status: Prisma.sql`i.status`,
    priority: Prisma.sql`CASE i.priority WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 WHEN 'URGENT' THEN 4 ELSE 0 END`,
    assignee: Prisma.sql`u.name`, dueDate: Prisma.sql`i."dueDate"`, updatedAt: Prisma.sql`i."updatedAt"`,
  }[state.sort];
  return Prisma.sql`${order} ${state.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`} NULLS LAST, i.id ASC`;
}
const columns = Prisma.sql`i.id, i."publicKey", i.title, i.status, i.type, i.priority, i.severity, i."assigneeId", u.name AS "assigneeName", i."dueDate", i."updatedAt", i."resourceName", i."storyPoints", i."parentIssueId"`;

export async function getIssueChildren(parentId: string, state: IssueListState, scope: IssueListScope, userId: string | null, offset = 0, client: Prisma.TransactionClient = db): Promise<IssueListRow[]> {
  return client.$queryRaw<IssueListRow[]>(Prisma.sql`SELECT ${columns}, TRUE AS matches, 0::int AS "childCount" FROM "Issue" i LEFT JOIN "User" u ON u.id = i."assigneeId" WHERE i."parentIssueId" = ${parentId} AND ${issueMatchSql(state, scope, userId, "i")} ORDER BY ${orderSql(state)} LIMIT 50 OFFSET ${offset}`);
}

export async function getIssueListPage(params: IssueListParams, scope: IssueListScope, userId: string | null): Promise<IssueListPage> {
  const state = parseIssueListState(params, scope);
  const parentMatch = issueMatchSql(state, scope, userId, "i");
  const childMatch = issueMatchSql(state, scope, userId, "c");
  const groupWhere = Prisma.sql`i."parentIssueId" IS NULL AND (${parentMatch} OR EXISTS (SELECT 1 FROM "Issue" c WHERE c."parentIssueId" = i.id AND ${childMatch}))`;
  return db.$transaction(async (tx) => {
    const [counts] = await tx.$queryRaw<{ groups: number; matches: number }[]>(Prisma.sql`SELECT (SELECT COUNT(*)::int FROM "Issue" i WHERE ${groupWhere}) AS groups, (SELECT COUNT(*)::int FROM "Issue" i WHERE ${parentMatch}) AS matches`);
    const pageCount = Math.max(1, Math.ceil(counts.groups / 50));
    state.page = Math.min(state.page, pageCount);
    const parents = await tx.$queryRaw<IssueListRow[]>(Prisma.sql`SELECT ${columns}, ${parentMatch} AS matches,
      (SELECT COUNT(*)::int FROM "Issue" c WHERE c."parentIssueId" = i.id AND ${childMatch}) AS "childCount"
      FROM "Issue" i LEFT JOIN "User" u ON u.id = i."assigneeId" WHERE ${groupWhere}
      ORDER BY ${orderSql(state)} LIMIT 50 OFFSET ${(state.page - 1) * 50}`);
    const groups: IssueGroup[] = [];
    for (const parent of parents) groups.push({ parent, expanded: !parent.matches, children: !parent.matches ? await getIssueChildren(parent.id, state, scope, userId, 0, tx) : [] });
    return { groups, state, groupCount: counts.groups, matchingCount: counts.matches, pageCount, scope };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
}
