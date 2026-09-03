"use server";

import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { discordSignInUrl } from "@/lib/auth-urls";
import { parseIssueTemplateFields, slugifyIssueTemplateName } from "@/lib/issue-templates";
import { canAccessSettings, getPermissionContext, requirePermission } from "@/lib/permissions";

function redirectToSignIn(callbackUrl = "/issues/templates"): never {
  redirect(discordSignInUrl(callbackUrl));
}

function revalidateTemplatePaths() {
  revalidatePath("/issues/new");
  revalidatePath("/issues/templates");
  revalidatePath("/settings");
}

async function requireTemplateManager() {
  const session = await auth();
  if (!session?.user?.id) redirectToSignIn();

  const permissions = await getPermissionContext(session.user.id);
  const denied = requirePermission(
    canAccessSettings(permissions),
    "You do not have permission to manage issue templates."
  );
  if (denied) throw new Error(denied.error);

  return session;
}

async function allocateUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugifyIssueTemplateName(base);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? root : `${root.slice(0, 70)}-${attempt + 1}`;
    const existing = await db.issueTemplate.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
  }
  throw new Error("Could not allocate a unique template slug.");
}

function fieldsFromFormData(formData: FormData) {
  return parseIssueTemplateFields({
    name: formData.get("name") as string | null,
    slug: formData.get("slug") as string | null,
    description: formData.get("description") as string | null,
    type: formData.get("type") as string | null,
    priority: formData.get("priority") as string | null,
    severity: formData.get("severity") as string | null,
    titleHint: formData.get("titleHint") as string | null,
    title: formData.get("title") as string | null,
    body: formData.get("body") as string | null,
    reproductionSteps: formData.get("reproductionSteps") as string | null,
    expectedBehavior: formData.get("expectedBehavior") as string | null,
    resourceName: formData.get("resourceName") as string | null,
    sortOrder: formData.get("sortOrder") as string | null,
  });
}

export async function createIssueTemplateAction(formData: FormData) {
  await requireTemplateManager();

  const parsed = fieldsFromFormData(formData);
  if (!parsed.ok) throw new Error(parsed.error);

  const slug = await allocateUniqueSlug(parsed.value.slug);
  await db.issueTemplate.create({
    data: { ...parsed.value, slug },
  });

  revalidateTemplatePaths();
}

export async function updateIssueTemplateAction(formData: FormData) {
  await requireTemplateManager();

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing template id.");

  const parsed = fieldsFromFormData(formData);
  if (!parsed.ok) throw new Error(parsed.error);

  const existing = await db.issueTemplate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Template not found.");

  const slug = await allocateUniqueSlug(parsed.value.slug, id);
  await db.issueTemplate.update({
    where: { id },
    data: { ...parsed.value, slug },
  });

  revalidateTemplatePaths();
}

export async function archiveIssueTemplateAction(formData: FormData) {
  await requireTemplateManager();

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing template id.");

  await db.issueTemplate.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  revalidateTemplatePaths();
}

export async function restoreIssueTemplateAction(formData: FormData) {
  await requireTemplateManager();

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing template id.");

  await db.issueTemplate.update({
    where: { id },
    data: { archivedAt: null },
  });

  revalidateTemplatePaths();
}
