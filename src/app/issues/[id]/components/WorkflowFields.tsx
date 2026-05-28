"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Input";
import { saveIssueWorkflow } from "@/app/actions";
import {
    PRIORITY_OPTIONS,
    SEVERITY_OPTIONS,
    STATUS_OPTIONS,
    TYPE_OPTIONS,
    type IssuePriority,
    type IssueSeverity,
    type IssueStatus,
    type IssueType,
} from "@/lib/issue-tokens";

export function WorkflowFields({
    issueId,
    defaultType,
    defaultPriority,
    defaultSeverity,
    defaultStatus,
}: {
    issueId: string;
    defaultType: IssueType;
    defaultPriority: IssuePriority;
    defaultSeverity: IssueSeverity;
    defaultStatus: IssueStatus;
}) {
    const [type, setType] = useState<string>(defaultType);
    const [priority, setPriority] = useState<string>(defaultPriority);
    const [severity, setSeverity] = useState<string>(defaultSeverity);
    const [status, setStatus] = useState<string>(defaultStatus);
    const [submitting, setSubmitting] = useState(false);

    return (
        <form
            action={async (formData) => {
                setSubmitting(true);
                try {
                    await saveIssueWorkflow(formData);
                } finally {
                    setSubmitting(false);
                }
            }}
            className="space-y-3"
        >
            <input type="hidden" name="issueId" value={issueId} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="priority" value={priority} />
            <input type="hidden" name="severity" value={severity} />
            <input type="hidden" name="status" value={status} />

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={type} onChange={setType} options={TYPE_OPTIONS} size="xs" />
                </div>
                <div className="space-y-1">
                    <Label>Priority</Label>
                    <Select
                        value={priority}
                        onChange={setPriority}
                        options={PRIORITY_OPTIONS}
                        size="xs"
                    />
                </div>
                <div className="space-y-1">
                    <Label>Severity</Label>
                    <Select
                        value={severity}
                        onChange={setSeverity}
                        options={SEVERITY_OPTIONS}
                        size="xs"
                    />
                </div>
                <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                        value={status}
                        onChange={setStatus}
                        options={STATUS_OPTIONS}
                        size="xs"
                    />
                </div>
            </div>

            <Button type="submit" variant="primary" size="xs" disabled={submitting}>
                {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
            </Button>
        </form>
    );
}
