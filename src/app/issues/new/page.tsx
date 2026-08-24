import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { canAccessSettings, getPermissionContext } from "@/lib/permissions";
import { ensureDefaultIssueTemplates } from "@/lib/issue-template-store";
import {
  findIssueTemplate,
  toIssueTemplateSummary,
} from "@/lib/issue-templates";
import { normalizeType } from "@/lib/issue-tokens";
import { NewIssueForm } from "./NewIssueForm";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; template?: string }>;
}) {
  const params = await searchParams;
  const [session] = await Promise.all([auth(), ensureDefaultIssueTemplates()]);
  const [permissions, templates] = await Promise.all([
    getPermissionContext(session?.user?.id),
    db.issueTemplate.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  const selected = findIssueTemplate(templates, params.template);

  return (
    <NewIssueForm
      key={`${selected?.id ?? "none"}-${params.status === "BACKLOG" ? "backlog" : "open"}-${normalizeType(params.type ?? "BUG")}`}
      templates={templates.map(toIssueTemplateSummary)}
      selectedTemplate={selected ? toIssueTemplateSummary(selected) : null}
      createInBacklog={params.status === "BACKLOG"}
      fallbackType={normalizeType(params.type ?? "BUG")}
      canManageTemplates={canAccessSettings(permissions)}
    />
  );
}
