import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { discordSignInUrl } from "@/lib/auth-urls";
import {
  canAccessSettings,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { ensureDefaultIssueTemplates } from "@/lib/issue-template-store";
import { toIssueTemplateSummary } from "@/lib/issue-templates";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TemplatesManager } from "./TemplatesManager";

export default async function IssueTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(discordSignInUrl("/issues/templates"));
  }

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canAccessSettings(permissions),
    "You do not have permission to manage issue templates."
  );
  if (denied) {
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="Issue templates"
          description="Access is limited to Owner and Admin."
          icon={<LayoutTemplate className="h-4 w-4" />}
        />
        <Card className="border-danger/30">
          <CardBody className="text-sm text-danger">{denied.error}</CardBody>
        </Card>
      </PageContainer>
    );
  }

  await ensureDefaultIssueTemplates();
  const templates = await db.issueTemplate.findMany({
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Issue templates"
        description="Named prefills for /issues/new. Using a template is optional."
        icon={<LayoutTemplate className="h-4 w-4" />}
        actions={
          <Link
            href="/issues/new"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 h-8 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            New issue
          </Link>
        }
      />
      <TemplatesManager templates={templates.map(toIssueTemplateSummary)} />
    </PageContainer>
  );
}
