import { ISSUE_ENUMS } from "./issue-validation";

export type IssueListParams = Record<string, string | string[] | undefined>;
export type IssueListScope = "all" | "triage" | "assigned" | "watching";
export const ISSUE_LIST_SORTS = ["id", "title", "type", "status", "priority", "assignee", "dueDate", "updatedAt"] as const;
export type IssueListState = { q: string; status: string; type: string; assignee: string; sort: typeof ISSUE_LIST_SORTS[number]; direction: "asc" | "desc"; page: number };
export function parseIssueListState(params: IssueListParams, scope: IssueListScope): IssueListState {
  const read = (key: string) => { const v = params[key]; return (Array.isArray(v) ? v[0] : v) || ""; };
  const statusDefault = scope === "all" ? "ACTIVE" : "ALL";
  const status = read("status") || statusDefault;
  const type = read("type") || "ALL";
  const pageText = read("page");
  const page = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  return {
    q: read("q").trim().slice(0, 500),
    status: ["ALL", "ACTIVE", ...ISSUE_ENUMS.status].includes(status) ? status : statusDefault,
    type: ["ALL", ...ISSUE_ENUMS.type].includes(type) ? type : "ALL",
    assignee: read("assignee").slice(0, 100) || "ALL",
    sort: ISSUE_LIST_SORTS.includes(read("sort") as IssueListState["sort"]) ? read("sort") as IssueListState["sort"] : "updatedAt",
    direction: read("direction") === "asc" ? "asc" : "desc",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000000) : 1,
  };
}

export function issueListSearchParams(state: IssueListState, scope: IssueListScope) {
  const params = new URLSearchParams({ q: state.q, status: state.status, type: state.type, assignee: state.assignee, sort: state.sort, direction: state.direction, page: String(state.page) });
  if (!state.q) params.delete("q");
  if (scope === "watching") params.set("view", "watching");
  return params;
}
