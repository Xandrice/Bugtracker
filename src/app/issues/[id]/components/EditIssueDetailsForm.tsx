"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { saveIssueDetails } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
    PRIORITY_OPTIONS,
    SEVERITY_OPTIONS,
    normalizePriority,
    normalizeSeverity,
} from "@/lib/issue-tokens";

type IssueForEdit = {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    severity: string;
    tags: string | null;
    label: string | null;
    dueDate: Date | null;
    storyPoints: number | null;
    resourceName: string | null;
    serverVersion: string | null;
    reproductionSteps: string | null;
    expectedBehavior: string | null;
    environment: string | null;
};

const LABEL_OPTIONS = [
    { value: "", label: "—" },
    { value: "SCRIPT", label: "Script" },
    { value: "MAP", label: "Map" },
    { value: "CAR", label: "Car" },
    { value: "CLOTHES", label: "Clothes" },
    { value: "OTHER", label: "Other / misc" },
];

export function EditIssueDetailsForm({ issue }: { issue: IssueForEdit }) {
    const [priority, setPriority] = useState<string>(normalizePriority(issue.priority));
    const [severity, setSeverity] = useState<string>(normalizeSeverity(issue.severity));
    const [label, setLabel] = useState<string>(issue.label ?? "");
    const [submitting, setSubmitting] = useState(false);
    const dueStr = issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : "";

    return (
        <details className="rounded-md border border-border bg-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                Edit details
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                    Status, type, and assignee live in the sidebar. Use this for narrative fields, tags,
                    and scheduling.
                </p>
            </summary>
            <form
                action={async (formData) => {
                    setSubmitting(true);
                    try {
                        await saveIssueDetails(formData);
                    } finally {
                        setSubmitting(false);
                    }
                }}
                className="space-y-4 border-t border-border p-4"
            >
                <input type="hidden" name="issueId" value={issue.id} />
                <input type="hidden" name="priority" value={priority} />
                <input type="hidden" name="severity" value={severity} />
                <input type="hidden" name="label" value={label} />

                <FieldRow label="Title" htmlFor="edit-title">
                    <Input id="edit-title" name="title" defaultValue={issue.title} required />
                </FieldRow>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldRow label="Priority">
                        <Select
                            value={priority}
                            onChange={setPriority}
                            options={PRIORITY_OPTIONS}
                            size="sm"
                        />
                    </FieldRow>
                    <FieldRow label="Severity">
                        <Select
                            value={severity}
                            onChange={setSeverity}
                            options={SEVERITY_OPTIONS}
                            size="sm"
                        />
                    </FieldRow>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldRow label="Due date" htmlFor="edit-due">
                        <Input
                            id="edit-due"
                            name="dueDate"
                            type="date"
                            defaultValue={dueStr}
                        />
                    </FieldRow>
                    <FieldRow label="Story points" htmlFor="edit-points">
                        <Input
                            id="edit-points"
                            name="storyPoints"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="—"
                            defaultValue={issue.storyPoints ?? ""}
                        />
                    </FieldRow>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldRow label="Tags" htmlFor="edit-tags">
                        <Input
                            id="edit-tags"
                            name="tags"
                            defaultValue={issue.tags ?? ""}
                            placeholder="comma separated"
                        />
                    </FieldRow>
                    <FieldRow label="Label / category">
                        <Select
                            value={label}
                            onChange={setLabel}
                            options={LABEL_OPTIONS}
                            size="sm"
                        />
                    </FieldRow>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldRow label="Resource" htmlFor="edit-resource">
                        <Input
                            id="edit-resource"
                            name="resourceName"
                            defaultValue={issue.resourceName ?? ""}
                            className="font-mono"
                        />
                    </FieldRow>
                    <FieldRow label="Server / build" htmlFor="edit-build">
                        <Input
                            id="edit-build"
                            name="serverVersion"
                            defaultValue={issue.serverVersion ?? ""}
                            className="font-mono"
                        />
                    </FieldRow>
                </div>

                <FieldRow label="Environment" htmlFor="edit-env">
                    <Input
                        id="edit-env"
                        name="environment"
                        defaultValue={issue.environment ?? ""}
                        placeholder="e.g. live, staging, reproducible on FX 6683"
                    />
                </FieldRow>

                <FieldRow label="Description" htmlFor="edit-desc">
                    <Textarea
                        id="edit-desc"
                        name="description"
                        rows={5}
                        defaultValue={issue.description ?? ""}
                    />
                </FieldRow>

                <FieldRow label="Steps to reproduce" htmlFor="edit-repro">
                    <Textarea
                        id="edit-repro"
                        name="reproductionSteps"
                        rows={4}
                        defaultValue={issue.reproductionSteps ?? ""}
                    />
                </FieldRow>

                <FieldRow label="Expected behavior" htmlFor="edit-expected">
                    <Textarea
                        id="edit-expected"
                        name="expectedBehavior"
                        rows={3}
                        defaultValue={issue.expectedBehavior ?? ""}
                    />
                </FieldRow>

                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                    {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save details
                </Button>
            </form>
        </details>
    );
}
