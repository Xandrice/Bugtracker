"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  archiveIssueTemplateAction,
  createIssueTemplateAction,
  restoreIssueTemplateAction,
  updateIssueTemplateAction,
} from "@/app/issue-template-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  PRIORITY_OPTIONS,
  SEVERITY_OPTIONS,
  TYPE_META,
  TYPE_OPTIONS,
  normalizePriority,
  normalizeSeverity,
  normalizeType,
  type IssuePriority,
  type IssueSeverity,
  type IssueType,
} from "@/lib/issue-tokens";
import type { IssueTemplateSummary } from "@/lib/issue-templates";

function SubmitLabel({ idle, pending }: { idle: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return <>{isPending ? pending : idle}</>;
}

function TemplateEditorFields({
  template,
}: {
  template?: IssueTemplateSummary;
}) {
  const [type, setType] = useState<IssueType>(normalizeType(template?.type ?? "BUG"));
  const [priority, setPriority] = useState<IssuePriority>(
    normalizePriority(template?.priority)
  );
  const [severity, setSeverity] = useState<IssueSeverity>(
    normalizeSeverity(template?.severity)
  );
  const isBug = type === "BUG";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldRow label="Name" htmlFor={`${template?.id ?? "new"}-name`}>
          <Input
            id={`${template?.id ?? "new"}-name`}
            name="name"
            defaultValue={template?.name ?? ""}
            placeholder="Bug report"
            maxLength={80}
            required
          />
        </FieldRow>
        <FieldRow
          label="Slug"
          htmlFor={`${template?.id ?? "new"}-slug`}
          hint="Used in /issues/new?template=. Leave blank to generate from the name."
        >
          <Input
            id={`${template?.id ?? "new"}-slug`}
            name="slug"
            defaultValue={template?.slug ?? ""}
            placeholder="bug-report"
            className="font-mono"
            maxLength={80}
          />
        </FieldRow>
      </div>

      <FieldRow
        label="Picker description"
        htmlFor={`${template?.id ?? "new"}-description`}
      >
        <Input
          id={`${template?.id ?? "new"}-description`}
          name="description"
          defaultValue={template?.description ?? ""}
          placeholder="Shown next to the name in the template picker"
        />
      </FieldRow>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FieldRow label="Type">
          <Select
            name="type"
            value={type}
            onChange={(value) => setType(normalizeType(value))}
            options={TYPE_OPTIONS}
            size="md"
          />
        </FieldRow>
        <FieldRow label="Priority">
          <Select
            name="priority"
            value={priority}
            onChange={(value) => setPriority(normalizePriority(value))}
            options={PRIORITY_OPTIONS}
            size="md"
          />
        </FieldRow>
        {isBug ? (
          <FieldRow label="Severity">
            <Select
              name="severity"
              value={severity}
              onChange={(value) => setSeverity(normalizeSeverity(value))}
              options={SEVERITY_OPTIONS}
              size="md"
            />
          </FieldRow>
        ) : (
          <input type="hidden" name="severity" value="MINOR" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldRow
          label="Title placeholder"
          htmlFor={`${template?.id ?? "new"}-titleHint`}
        >
          <Input
            id={`${template?.id ?? "new"}-titleHint`}
            name="titleHint"
            defaultValue={template?.titleHint ?? ""}
            placeholder="E.g. Police MDT fails to load when off duty"
          />
        </FieldRow>
        <FieldRow
          label="Prefill title"
          htmlFor={`${template?.id ?? "new"}-title`}
          hint="Optional. Leave blank to only set the placeholder."
        >
          <Input
            id={`${template?.id ?? "new"}-title`}
            name="title"
            defaultValue={template?.title ?? ""}
            placeholder="Leave blank unless every issue should start with the same title"
          />
        </FieldRow>
      </div>

      <FieldRow label="Description body" htmlFor={`${template?.id ?? "new"}-body`}>
        <Textarea
          id={`${template?.id ?? "new"}-body`}
          name="body"
          rows={5}
          defaultValue={template?.body ?? ""}
          placeholder="Prefills the description on /issues/new"
        />
      </FieldRow>

      {isBug && (
        <>
          <FieldRow
            label="Steps to reproduce"
            htmlFor={`${template?.id ?? "new"}-reproductionSteps`}
          >
            <Textarea
              id={`${template?.id ?? "new"}-reproductionSteps`}
              name="reproductionSteps"
              rows={3}
              defaultValue={template?.reproductionSteps ?? ""}
            />
          </FieldRow>
          <FieldRow
            label="Expected behavior"
            htmlFor={`${template?.id ?? "new"}-expectedBehavior`}
          >
            <Textarea
              id={`${template?.id ?? "new"}-expectedBehavior`}
              name="expectedBehavior"
              rows={2}
              defaultValue={template?.expectedBehavior ?? ""}
            />
          </FieldRow>
          <FieldRow
            label="Resource name"
            htmlFor={`${template?.id ?? "new"}-resourceName`}
          >
            <Input
              id={`${template?.id ?? "new"}-resourceName`}
              name="resourceName"
              defaultValue={template?.resourceName ?? ""}
              placeholder="e.g. ox_inventory"
            />
          </FieldRow>
        </>
      )}

      <FieldRow
        label="Sort order"
        htmlFor={`${template?.id ?? "new"}-sortOrder`}
        hint="Lower numbers appear first in the picker."
      >
        <Input
          id={`${template?.id ?? "new"}-sortOrder`}
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={template?.sortOrder ?? 100}
        />
      </FieldRow>
    </div>
  );
}

function TemplateCard({ template }: { template: IssueTemplateSummary }) {
  const archived = !!template.archivedAt;
  const typeMeta = TYPE_META[template.type as IssueType] ?? TYPE_META.BUG;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{template.name}</CardTitle>
            <Badge tone={typeMeta.tone} size="xs">
              {typeMeta.label}
            </Badge>
            {archived && (
              <Badge tone="neutral" size="xs">
                Archived
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground">{template.description}</p>
          )}
        </div>
        {archived ? (
          <form action={restoreIssueTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" size="xs" variant="outline">
              <SubmitLabel idle="Restore" pending="Restoring…" />
            </Button>
          </form>
        ) : (
          <form action={archiveIssueTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" size="xs" variant="danger">
              <SubmitLabel idle="Archive" pending="Archiving…" />
            </Button>
          </form>
        )}
      </CardHeader>
      <CardBody>
        <form action={updateIssueTemplateAction} className="space-y-4">
          <input type="hidden" name="id" value={template.id} />
          <TemplateEditorFields template={template} />
          <Button type="submit" size="sm">
            <SubmitLabel idle="Save template" pending="Saving…" />
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function TemplatesManager({
  templates,
}: {
  templates: IssueTemplateSummary[];
}) {
  const active = templates.filter((template) => !template.archivedAt);
  const archived = templates.filter((template) => template.archivedAt);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>New template</CardTitle>
            <p className="text-xs text-muted-foreground">
              Staff can pick this on /issues/new. Using a template stays optional.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createIssueTemplateAction} className="space-y-4">
            <TemplateEditorFields />
            <Button type="submit" variant="primary" size="sm">
              <SubmitLabel idle="Create template" pending="Creating…" />
            </Button>
          </form>
        </CardBody>
      </Card>

      {active.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}

      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
            Archived
          </h2>
          {archived.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
