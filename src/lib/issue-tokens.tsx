import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Bug as BugIcon,
    CheckCircle2,
    Circle,
    CircleDashed,
    CircleDot,
    Lightbulb,
    Minus,
    KanbanSquare,
    SquareDot,
} from "lucide-react";
import type { ReactNode } from "react";

export type IssueStatus = "BACKLOG" | "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type IssueType = "BUG" | "FEATURE" | "TASK";
export type IssueSeverity = "MINOR" | "MAJOR" | "CRITICAL" | "BLOCKER";
export type IssueLinkType = "BLOCKS" | "BLOCKED_BY" | "RELATES_TO" | "DUPLICATES";

export const STATUS_META: Record<IssueStatus, {
    label: string;
    short: string;
    icon: ReactNode;
    tone: "neutral" | "info" | "warning" | "primary" | "success";
}> = {
    BACKLOG: { label: "Backlog", short: "Backlog", icon: <KanbanSquare className="h-3.5 w-3.5" />, tone: "neutral" },
    OPEN: { label: "Open", short: "Open", icon: <CircleDashed className="h-3.5 w-3.5" />, tone: "info" },
    IN_PROGRESS: { label: "In Progress", short: "In progress", icon: <CircleDot className="h-3.5 w-3.5" />, tone: "warning" },
    REVIEW: { label: "Review", short: "Review", icon: <AlertCircle className="h-3.5 w-3.5" />, tone: "primary" },
    DONE: { label: "Done", short: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: "success" },
};

export const PRIORITY_META: Record<IssuePriority, {
    label: string;
    short: string;
    icon: ReactNode;
    tone: "neutral" | "warning" | "danger";
}> = {
    URGENT: { label: "Urgent", short: "P0", icon: <AlertCircle className="h-3.5 w-3.5 text-danger" />, tone: "danger" },
    HIGH: { label: "High", short: "P1", icon: <ArrowUp className="h-3.5 w-3.5 text-warning" />, tone: "warning" },
    MEDIUM: { label: "Medium", short: "P2", icon: <Minus className="h-3.5 w-3.5 text-muted-foreground" />, tone: "neutral" },
    LOW: { label: "Low", short: "P3", icon: <ArrowDown className="h-3.5 w-3.5 text-subtle-foreground" />, tone: "neutral" },
};

export const TYPE_META: Record<IssueType, {
    label: string;
    short: string;
    icon: ReactNode;
    tone: "danger" | "info" | "neutral";
}> = {
    BUG: { label: "Bug", short: "Bug", icon: <BugIcon className="h-3.5 w-3.5 text-danger" />, tone: "danger" },
    FEATURE: { label: "Feature", short: "Feature", icon: <Lightbulb className="h-3.5 w-3.5 text-info" />, tone: "info" },
    TASK: { label: "Task", short: "Task", icon: <SquareDot className="h-3.5 w-3.5 text-muted-foreground" />, tone: "neutral" },
};

export const SEVERITY_META: Record<IssueSeverity, {
    label: string;
    short: string;
    description: string;
    tone: "neutral" | "warning" | "danger";
}> = {
    MINOR: { label: "Minor", short: "Minor", description: "1–5 affected", tone: "neutral" },
    MAJOR: { label: "Major", short: "Major", description: "6–20 affected", tone: "warning" },
    CRITICAL: { label: "Critical", short: "Critical", description: "21+ affected", tone: "danger" },
    BLOCKER: { label: "Blocker", short: "Blocker", description: "Most or all affected", tone: "danger" },
};

export const LINK_TYPE_META: Record<IssueLinkType, {
    label: string;
    inverse: IssueLinkType;
}> = {
    BLOCKS: { label: "Blocks", inverse: "BLOCKED_BY" },
    BLOCKED_BY: { label: "Blocked by", inverse: "BLOCKS" },
    RELATES_TO: { label: "Relates to", inverse: "RELATES_TO" },
    DUPLICATES: { label: "Duplicates", inverse: "DUPLICATES" },
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as IssueStatus[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
    icon: STATUS_META[s].icon,
}));

export const PRIORITY_OPTIONS = (Object.keys(PRIORITY_META) as IssuePriority[]).map((s) => ({
    value: s,
    label: `${PRIORITY_META[s].short} · ${PRIORITY_META[s].label}`,
    short: PRIORITY_META[s].short,
    icon: PRIORITY_META[s].icon,
}));

export const TYPE_OPTIONS = (Object.keys(TYPE_META) as IssueType[]).map((s) => ({
    value: s,
    label: TYPE_META[s].label,
    icon: TYPE_META[s].icon,
}));

export const SEVERITY_OPTIONS = (Object.keys(SEVERITY_META) as IssueSeverity[]).map((s) => ({
    value: s,
    label: `${SEVERITY_META[s].label} · ${SEVERITY_META[s].description}`,
    short: SEVERITY_META[s].label,
}));

export const LINK_TYPE_OPTIONS = (Object.keys(LINK_TYPE_META) as IssueLinkType[]).map(
    (s) => ({ value: s, label: LINK_TYPE_META[s].label })
);

export function normalizeStatus(v: string | null | undefined): IssueStatus {
    return v && v in STATUS_META ? (v as IssueStatus) : "OPEN";
}
export function normalizePriority(v: string | null | undefined): IssuePriority {
    return v && v in PRIORITY_META ? (v as IssuePriority) : "MEDIUM";
}
export function normalizeType(v: string | null | undefined): IssueType {
    return v && v in TYPE_META ? (v as IssueType) : "BUG";
}
export function normalizeSeverity(v: string | null | undefined): IssueSeverity {
    return v && v in SEVERITY_META ? (v as IssueSeverity) : "MINOR";
}
