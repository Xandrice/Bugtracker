import type { IssueGroup, IssueListRow } from "./issue-list";

/** Preserve expansion, but obtain every displayed child from the current server query. */
export async function refreshIssueGroups(
  previous: IssueGroup[], incoming: IssueGroup[],
  load: (parentId: string, offset: number) => Promise<IssueListRow[]>,
): Promise<IssueGroup[]> {
  return Promise.all(incoming.map(async (group) => {
    const old = previous.find((item) => item.parent.id === group.parent.id);
    const expanded = old?.expanded ?? group.expanded;
    if (!expanded) return { ...group, expanded, children: [] };
    const wanted = Math.min(group.parent.childCount, Math.max(50, old?.children.length || 0));
    const children: IssueListRow[] = [];
    for (let offset = 0; offset < wanted; offset += 50) {
      const rows = await load(group.parent.id, offset);
      children.push(...rows);
      if (rows.length < 50) break;
    }
    return { ...group, expanded, children };
  }));
}

export function retainMatchingSelection(selected: string[], groups: IssueGroup[]): string[] {
  const eligible = new Set(groups.flatMap((g) => [g.parent, ...g.children]).filter((row) => row.matches).map((row) => row.id));
  return selected.filter((id) => eligible.has(id));
}
