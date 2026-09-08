import { auth } from "@/../auth";
import { getIssueListPage } from "@/lib/issue-list";
import { issueListSearchParams, type IssueListParams, type IssueListScope } from "@/lib/issue-list-state";
import { getPermissionContext, canAssignIssues } from "@/lib/permissions";
import { getStaffUsers } from "@/lib/staff";
import { getMySavedViews } from "@/app/staff-actions";
import { PagedIssueGrid } from "./PagedIssueGrid";

export async function IssueListView({ params, scope }: { params: IssueListParams; scope: IssueListScope }) {
  const session = await auth();
  if ((scope === "assigned" || scope === "watching") && !session?.user?.id) return null;
  const permissions = await getPermissionContext(session?.user?.id);
  const [page, users, saved] = await Promise.all([getIssueListPage(params, scope, session?.user?.id ?? null), getStaffUsers(), session?.user?.id ? getMySavedViews() : []]);
  const savedViews = saved.flatMap((view: { id: string; name: string; filters: string }) => {
    try { const filters = JSON.parse(view.filters); return filters && typeof filters === "object" && !Array.isArray(filters) ? [{ id: view.id, name: view.name, filters }] : []; } catch { return []; }
  });
  return <PagedIssueGrid key={`${scope}-${issueListSearchParams(page.state, scope)}`} page={page} users={users.map((user) => ({ id: user.id, name: user.name }))} canEdit={!!session?.user?.id} canAssign={canAssignIssues(permissions)} signedIn={!!session?.user?.id} savedViews={savedViews} />;
}
