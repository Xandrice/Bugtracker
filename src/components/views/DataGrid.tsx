"use client";

import {
    PRIORITY_META, SEVERITY_META, STATUS_META, TYPE_META,
    type IssuePriority, type IssueSeverity, type IssueStatus, type IssueType,
} from "@/lib/issue-tokens";
import { Badge } from "@/components/ui/Badge";

// ---- Backwards-compat re-exports for any page still importing these ----
export type { IssueStatus, IssuePriority, IssueType, IssueSeverity } from "@/lib/issue-tokens";

export const statusStyles: Record<IssueStatus, string> = {
    BACKLOG: "bg-muted text-muted-foreground border-border",
    OPEN: "bg-info/12 text-info border-info/30",
    IN_PROGRESS: "bg-warning/12 text-warning border-warning/30",
    REVIEW: "bg-primary/12 text-primary border-primary/30",
    DONE: "bg-success/12 text-success border-success/30",
};

export const typeStyles: Record<IssueType, string> = {
    BUG: "bg-danger/12 text-danger border-danger/30",
    FEATURE: "bg-info/12 text-info border-info/30",
    TASK: "bg-muted text-muted-foreground border-border",
};

export const priorityLabels: Record<IssuePriority, string> = {
    URGENT: "P0 · Urgent",
    HIGH: "P1 · High",
    MEDIUM: "P2 · Medium",
    LOW: "P3 · Low",
};

export const StatusIcon = ({ status }: { status: IssueStatus }) => (
    <>{STATUS_META[status].icon}</>
);
export const PriorityIcon = ({ priority }: { priority: IssuePriority }) => (
    <>{PRIORITY_META[priority].icon}</>
);
export const TypeIcon = ({ type }: { type: IssueType }) => (
    <>{TYPE_META[type].icon}</>
);

// ---- Snippet shape ----

export interface UserSnippet {
    id: string;
    name: string | null;
    image: string | null;
}

export interface IssueSnippet {
    id: string;
    publicKey?: string | null;
    title: string;
    status: IssueStatus;
    priority: IssuePriority;
    type: IssueType;
    assignee: UserSnippet | null;
    updatedAt: Date;
    severity?: IssueSeverity;
    environment?: string | null;
    tags?: string | null;
    dueDate?: Date | null;
    resourceName?: string | null;
    storyPoints?: number | null;
    parentIssueId?: string | null;
    parentIssueRef?: string | null;
    subtaskCount?: number;
}

// ---- Inline badges used elsewhere (issue detail page, kanban) ----

export function StatusBadge({ status }: { status: IssueStatus }) {
    const meta = STATUS_META[status];
    return (
        <Badge tone={meta.tone}>
            {meta.icon} {meta.label}
        </Badge>
    );
}
export function PriorityBadge({ priority }: { priority: IssuePriority }) {
    const meta = PRIORITY_META[priority];
    return (
        <Badge tone={meta.tone}>
            {meta.icon} {meta.label}
        </Badge>
    );
}
export function TypeBadge({ type }: { type: IssueType }) {
    const meta = TYPE_META[type];
    return (
        <Badge tone={meta.tone}>
            {meta.icon} {meta.label}
        </Badge>
    );
}
export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
    const meta = SEVERITY_META[severity];
    return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
