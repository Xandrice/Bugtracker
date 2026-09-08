"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { mergeIssueTemplate } from "@/lib/issue-draft";
import { ArrowLeft, Calendar, Loader2, Save } from "lucide-react";

import { createIssue } from "@/app/actions";
import { IssueActionForm, IssueFieldError, useIssueFormState } from "@/components/issues/IssueActionForm";
import { PageContainer } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  PRIORITY_OPTIONS,
  SEVERITY_OPTIONS,
  TYPE_OPTIONS,
  normalizePriority,
  normalizeSeverity,
  normalizeType,
  type IssueType,
} from "@/lib/issue-tokens";
import {
  issueFormPrefillFromTemplate,
  type IssueFormPrefill,
  type IssueTemplateSummary,
} from "@/lib/issue-templates";

function SubmitButton() {
  const { pending } = useIssueFormState();
  return (
    <Button type="submit" variant="primary" size="md" disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {pending ? "Creating…" : "Create issue"}
    </Button>
  );
}

const LABEL_OPTIONS = [
  { value: "", label: "—" },
  { value: "SCRIPT", label: "Script" },
  { value: "MAP", label: "Map" },
  { value: "CAR", label: "Car" },
  { value: "CLOTHES", label: "Clothes" },
  { value: "OTHER", label: "Other / misc" },
];

const SEVERITY_HINT: Record<string, string> = {
  MINOR: "Affects a few players (1–5) with a workaround available.",
  MAJOR: "Affects multiple players (6–20) and disrupts normal play.",
  CRITICAL: "Affects many players (21+) and blocks core gameplay loops.",
  BLOCKER: "Affects nearly everyone and prevents the server or feature from being used.",
};

type IssueDraft = Record<string, string>;
function templateDraft(prefill: IssueFormPrefill): IssueDraft {
  return { title: prefill.title, description: prefill.description, type: prefill.type, priority: prefill.priority, severity: prefill.severity,
    reproductionSteps: prefill.reproductionSteps, expectedBehavior: prefill.expectedBehavior, resourceName: prefill.resourceName };
}
function IssueFields({ prefill, createInBacklog, draft, edit }: {
  prefill: IssueFormPrefill; createInBacklog: boolean; draft: IssueDraft; edit: (field: string, value: string) => void;
}) {
  const { severity, type, priority, label } = draft;
  const isBug = type === "BUG";
  return (
    <IssueActionForm action={createIssue}>
      {!isBug && <input type="hidden" name="severity" value="MINOR" />}
      {createInBacklog && <input type="hidden" name="status" value="BACKLOG" />}
      <CardBody className="space-y-5">
          <FieldRow label="Title" htmlFor="title">
            <Input
              id="title"
              name="title"
              placeholder={prefill.titlePlaceholder}
              required
            value={draft["title"] || ""} onChange={(event) => edit("title", event.target.value)} />
          <IssueFieldError field="title" />
          </FieldRow>

          <div className={`grid grid-cols-1 gap-3 ${isBug ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <FieldRow label="Type" htmlFor="type">
              <Select
                name="type"
                value={type}
                onChange={(v) => edit("type", normalizeType(v))}
                options={TYPE_OPTIONS}
                size="md"
              />
            <IssueFieldError field="type" />
          </FieldRow>
            <FieldRow label="Priority" htmlFor="priority">
              <Select
                name="priority"
                value={priority}
                onChange={(v) => edit("priority", normalizePriority(v))}
                options={PRIORITY_OPTIONS}
                size="md"
              />
            <IssueFieldError field="priority" />
          </FieldRow>
            {isBug && (
              <FieldRow label="Severity" htmlFor="severity" hint={SEVERITY_HINT[severity]}>
                <Select
                  name="severity"
                  value={severity}
                  onChange={(v) => edit("severity", normalizeSeverity(v))}
                  options={SEVERITY_OPTIONS}
                  size="md"
                />
              <IssueFieldError field="severity" />
          </FieldRow>
            )}
          </div>

          {isBug && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldRow label="Resource name" htmlFor="resourceName">
                <Input
                  id="resourceName"
                  name="resourceName"
                  placeholder="e.g. police-mdt"
                value={draft["resourceName"] || ""} onChange={(event) => edit("resourceName", event.target.value)} />
              <IssueFieldError field="resourceName" />
          </FieldRow>
              <FieldRow label="Label / category" htmlFor="label">
                <Select
                  name="label"
                  value={label}
                  onChange={(value) => edit("label", value)}
                  options={LABEL_OPTIONS}
                  size="md"
                />
              <IssueFieldError field="label" />
          </FieldRow>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldRow label="Tags" htmlFor="tags">
              <Input
                id="tags"
                name="tags"
                placeholder={isBug ? "resource:police-mdt, ui, lua" : "frontend, docs, qol"}
              value={draft["tags"] || ""} onChange={(event) => edit("tags", event.target.value)} />
            <IssueFieldError field="tags" />
          </FieldRow>
            {!isBug && (
              <FieldRow label="Label / category" htmlFor="label">
                <Select
                  name="label"
                  value={label}
                  onChange={(value) => edit("label", value)}
                  options={LABEL_OPTIONS}
                  size="md"
                />
              <IssueFieldError field="label" />
          </FieldRow>
            )}
            {isBug && (
              <FieldRow label="Due date" htmlFor="dueDate">
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle-foreground" />
                  <Input id="dueDate" name="dueDate" type="date" className="pl-8" value={draft["dueDate"] || ""} onChange={(event) => edit("dueDate", event.target.value)} />
                </div>
              <IssueFieldError field="dueDate" />
          </FieldRow>
            )}
          </div>

          {!isBug && (
            <FieldRow label="Due date" htmlFor="dueDate">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle-foreground" />
                <Input id="dueDate" name="dueDate" type="date" className="pl-8" value={draft["dueDate"] || ""} onChange={(event) => edit("dueDate", event.target.value)} />
              </div>
            <IssueFieldError field="dueDate" />
          </FieldRow>
          )}

          <FieldRow
            label="Discord forum post (optional)"
            htmlFor="discordPostId"
            hint="Paste a Discord post link or post ID — the bot will add a tracker notice."
          >
            <Input
              id="discordPostId"
              name="discordPostId"
              className="font-mono"
              placeholder="https://discord.com/channels/.../1489040926197289083"
            value={draft["discordPostId"] || ""} onChange={(event) => edit("discordPostId", event.target.value)} />
          <IssueFieldError field="discordPostId" />
          </FieldRow>

          <FieldRow label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={5}
              placeholder={
                isBug
                  ? "What happened? Include error messages if you have them."
                  : "What do you want built or changed? Be specific."
              }
            value={draft["description"] || ""} onChange={(event) => edit("description", event.target.value)} />
          <IssueFieldError field="description" />
          </FieldRow>

          {isBug && (
            <>
              <FieldRow label="Steps to reproduce" htmlFor="reproductionSteps">
                <Textarea
                  id="reproductionSteps"
                  name="reproductionSteps"
                  rows={4}
                  placeholder="1. Go to… 2. Click… 3. See error"
                value={draft["reproductionSteps"] || ""} onChange={(event) => edit("reproductionSteps", event.target.value)} />
              <IssueFieldError field="reproductionSteps" />
          </FieldRow>
              <FieldRow label="Expected behavior" htmlFor="expectedBehavior">
                <Textarea
                  id="expectedBehavior"
                  name="expectedBehavior"
                  rows={3}
                  placeholder="What should have happened instead?"
                value={draft["expectedBehavior"] || ""} onChange={(event) => edit("expectedBehavior", event.target.value)} />
              <IssueFieldError field="expectedBehavior" />
          </FieldRow>
            </>
          )}
      </CardBody>
      <CardFooter>
        <Link
          href="/issues"
          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 h-9 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancel
        </Link>
        <SubmitButton />
      </CardFooter>
    </IssueActionForm>
  );
}

export function NewIssueForm({
  templates,
  selectedTemplate,
  createInBacklog,
  fallbackType,
  canManageTemplates,
}: {
  templates: IssueTemplateSummary[];
  selectedTemplate: IssueTemplateSummary | null;
  createInBacklog: boolean;
  fallbackType: IssueType;
  canManageTemplates: boolean;
}) {
  const [templateId, setTemplateId] = useState(selectedTemplate?.id ?? "");
  const [draft, setDraft] = useState<IssueDraft>(() => ({ label: "", tags: "", dueDate: "", discordPostId: "", ...templateDraft(issueFormPrefillFromTemplate(selectedTemplate, fallbackType)) }));
  const dirty = useRef(new Set<string>());
  const selected = templates.find((template) => template.id === templateId) ?? null;
  const prefill = issueFormPrefillFromTemplate(selected, fallbackType);
  const edit = (field: string, value: string) => {
    dirty.current.add(field);
    setDraft((previous) => ({ ...previous, [field]: value }));
  };
  const pickTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id) ?? null;
    setTemplateId(id);
    setDraft((previous) => mergeIssueTemplate(previous, templateDraft(issueFormPrefillFromTemplate(template, fallbackType)), dirty.current));
    const query = new URLSearchParams(window.location.search);
    if (id) query.set("template", template?.slug || id); else query.delete("template");
    // Native history integration updates the URL without remounting the draft.
    window.history.replaceState(null, "", query.size ? `/issues/new?${query}` : "/issues/new");
  };

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href={createInBacklog ? "/issues/backlog" : "/issues"}
        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {createInBacklog ? "Back to backlog" : "Back to issues"}
      </Link>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>New issue</CardTitle>
            <p className="text-xs text-muted-foreground">
              {createInBacklog
                ? "This issue will be added at the bottom of the backlog."
                : prefill.type === "BUG"
                  ? "Report a bug with repro steps and severity so it can be triaged quickly."
                  : "Submit a task or feature request. Switch type to Bug for the full report form."}
            </p>
          </div>
        </CardHeader>
        {templates.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <FieldRow
              label="Template"
              htmlFor="issue-template"
              hint="Optional. Prefills type, priority, and bug fields. You can still edit everything."
            >
              <Select
                aria-label="Issue template"
                value={templateId}
                onChange={pickTemplate}
                options={[
                  { value: "", label: "No template" },
                  ...templates.map((template) => ({
                    value: template.id,
                    short: template.name,
                    label: template.description
                      ? `${template.name} — ${template.description}`
                      : template.name,
                  })),
                ]}
                size="md"
              />
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => {
                if (window.confirm("Replace your edited template fields with this template? Other report fields will be kept.")) {
                  setDraft((previous) => mergeIssueTemplate(previous, templateDraft(prefill), dirty.current, true));
                  for (const field of Object.keys(templateDraft(prefill))) dirty.current.delete(field);
                }
              }}>Replace edited fields with template</button>
              {canManageTemplates && (
                <p className="text-[11px] text-subtle-foreground">
                  <Link href="/issues/templates" className="hover:text-foreground">
                    Manage templates
                  </Link>
                </p>
              )}
            <IssueFieldError field="issue-template" />
          </FieldRow>
          </div>
        )}
        <IssueFields
          draft={draft}
          edit={edit}
          prefill={prefill}
          createInBacklog={createInBacklog}
        />
      </Card>
    </PageContainer>
  );
}
