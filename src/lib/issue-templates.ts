import {
  normalizePriority,
  normalizeSeverity,
  normalizeType,
  type IssuePriority,
  type IssueSeverity,
  type IssueType,
} from "./issue-tokens";

export type IssueTemplateSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  priority: string;
  severity: string;
  titleHint: string | null;
  title: string | null;
  body: string | null;
  reproductionSteps: string | null;
  expectedBehavior: string | null;
  resourceName: string | null;
  sortOrder: number;
  archivedAt: string | Date | null;
};

export type IssueTemplateInput = {
  name: string;
  slug: string;
  description: string | null;
  type: IssueType;
  priority: IssuePriority;
  severity: IssueSeverity;
  titleHint: string | null;
  title: string | null;
  body: string | null;
  reproductionSteps: string | null;
  expectedBehavior: string | null;
  resourceName: string | null;
  sortOrder: number;
};

export type IssueFormPrefill = {
  type: IssueType;
  priority: IssuePriority;
  severity: IssueSeverity;
  title: string;
  titlePlaceholder: string;
  description: string;
  reproductionSteps: string;
  expectedBehavior: string;
  resourceName: string;
};

const DEFAULT_TITLE_PLACEHOLDER: Record<IssueType, string> = {
  BUG: "E.g. Police MDT fails to load when off duty",
  FEATURE: "E.g. Add inventory weight indicator",
  TASK: "E.g. Restock hospital pharmacy props",
};

export const DEFAULT_ISSUE_TEMPLATES: Array<
  IssueTemplateInput & { id: string }
> = [
  {
    id: "issue-template-bug-report",
    slug: "bug-report",
    name: "Bug report",
    description: "Repro steps, expected behavior, and who is affected.",
    type: "BUG",
    priority: "MEDIUM",
    severity: "MINOR",
    titleHint: "E.g. Police MDT fails to load when off duty",
    title: null,
    body: [
      "What happened?",
      "",
      "Who was affected (how many players, which jobs or areas)?",
      "",
      "Client or server errors (F8, txAdmin, or server console):",
    ].join("\n"),
    reproductionSteps: "1.\n2.\n3.",
    expectedBehavior: "What should have happened instead?",
    resourceName: null,
    sortOrder: 10,
  },
  {
    id: "issue-template-script-crash",
    slug: "script-crash",
    name: "Script crash",
    description: "Resource exception or crash that takes a script down.",
    type: "BUG",
    priority: "HIGH",
    severity: "CRITICAL",
    titleHint: "E.g. ox_inventory crashes when using an item",
    title: null,
    body: [
      "Which resource crashed (fxmanifest / resource folder name)?",
      "",
      "Client, server, or both?",
      "",
      "Error or stack trace from F8 or the server console:",
      "",
      "Did the resource restart, or did it stay dead?",
    ].join("\n"),
    reproductionSteps: "1. Start or join the server\n2.\n3. Crash or exception occurs",
    expectedBehavior:
      "The resource should stay running and handle the failure without taking the script down.",
    resourceName: null,
    sortOrder: 20,
  },
  {
    id: "issue-template-feature-request",
    slug: "feature-request",
    name: "Feature request",
    description: "New player or staff capability, with problem and proposed change.",
    type: "FEATURE",
    priority: "MEDIUM",
    severity: "MINOR",
    titleHint: "E.g. Add inventory weight indicator",
    title: null,
    body: [
      "Problem — what is awkward or missing for staff or players?",
      "",
      "Proposed change:",
      "",
      "Who does this help (players, a job, staff)?",
      "",
      "Anything this should not change?",
    ].join("\n"),
    reproductionSteps: null,
    expectedBehavior: null,
    resourceName: null,
    sortOrder: 30,
  },
  {
    id: "issue-template-player-facing-task",
    slug: "player-facing-task",
    name: "Player-facing task",
    description: "World, prop, or job work players will notice in-game.",
    type: "TASK",
    priority: "MEDIUM",
    severity: "MINOR",
    titleHint: "E.g. Restock hospital pharmacy props after the interior update",
    title: null,
    body: [
      "What should players see or be able to do when this is done?",
      "",
      "Location / job / area:",
      "",
      "Acceptance:",
      "-",
    ].join("\n"),
    reproductionSteps: null,
    expectedBehavior: null,
    resourceName: null,
    sortOrder: 40,
  },
];

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function slugifyIssueTemplateName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "template";
}

export function findIssueTemplate<T extends { id: string; slug: string }>(
  templates: T[],
  raw: string | null | undefined
): T | null {
  const key = (raw ?? "").trim();
  if (!key) return null;
  return templates.find((template) => template.id === key || template.slug === key) ?? null;
}

export function toIssueTemplateSummary(template: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  priority: string;
  severity: string;
  titleHint: string | null;
  title: string | null;
  body: string | null;
  reproductionSteps: string | null;
  expectedBehavior: string | null;
  resourceName: string | null;
  sortOrder: number;
  archivedAt: Date | null;
}): IssueTemplateSummary {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    type: template.type,
    priority: template.priority,
    severity: template.severity,
    titleHint: template.titleHint,
    title: template.title,
    body: template.body,
    reproductionSteps: template.reproductionSteps,
    expectedBehavior: template.expectedBehavior,
    resourceName: template.resourceName,
    sortOrder: template.sortOrder,
    archivedAt: template.archivedAt ? template.archivedAt.toISOString() : null,
  };
}

export function issueFormPrefillFromTemplate(
  template: Pick<
    IssueTemplateSummary,
    | "type"
    | "priority"
    | "severity"
    | "titleHint"
    | "title"
    | "body"
    | "reproductionSteps"
    | "expectedBehavior"
    | "resourceName"
  > | null,
  fallbackType: IssueType = "BUG"
): IssueFormPrefill {
  const type = normalizeType(template?.type ?? fallbackType);
  const isBug = type === "BUG";
  return {
    type,
    priority: normalizePriority(template?.priority),
    severity: isBug ? normalizeSeverity(template?.severity) : "MINOR",
    title: template?.title?.trim() ?? "",
    titlePlaceholder: emptyToNull(template?.titleHint) || DEFAULT_TITLE_PLACEHOLDER[type],
    description: template?.body ?? "",
    reproductionSteps: template?.reproductionSteps ?? "",
    expectedBehavior: template?.expectedBehavior ?? "",
    resourceName: template?.resourceName ?? "",
  };
}

export function parseIssueTemplateFields(input: {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  type?: string | null;
  priority?: string | null;
  severity?: string | null;
  titleHint?: string | null;
  title?: string | null;
  body?: string | null;
  reproductionSteps?: string | null;
  expectedBehavior?: string | null;
  resourceName?: string | null;
  sortOrder?: string | number | null;
}): { ok: true; value: IssueTemplateInput } | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Template name is required." };
  if (name.length > 80) return { ok: false, error: "Template name must be 80 characters or fewer." };

  const slug = slugifyIssueTemplateName(input.slug || name);
  if (slug.length > 80) return { ok: false, error: "Template slug must be 80 characters or fewer." };

  const sortRaw =
    typeof input.sortOrder === "number"
      ? input.sortOrder
      : Number.parseInt(String(input.sortOrder ?? "0").trim() || "0", 10);
  if (!Number.isFinite(sortRaw)) return { ok: false, error: "Sort order must be a number." };
  const sortOrder = Math.min(9999, Math.max(0, Math.trunc(sortRaw)));

  const type = normalizeType(input.type);
  return {
    ok: true,
    value: {
      name,
      slug,
      description: emptyToNull(input.description),
      type,
      priority: normalizePriority(input.priority),
      severity: type === "BUG" ? normalizeSeverity(input.severity) : "MINOR",
      titleHint: emptyToNull(input.titleHint),
      title: emptyToNull(input.title),
      body: emptyToNull(input.body),
      reproductionSteps: type === "BUG" ? emptyToNull(input.reproductionSteps) : null,
      expectedBehavior: type === "BUG" ? emptyToNull(input.expectedBehavior) : null,
      resourceName: type === "BUG" ? emptyToNull(input.resourceName) : null,
      sortOrder,
    },
  };
}
