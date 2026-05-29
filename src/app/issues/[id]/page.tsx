import {
    Calendar,
    ChevronRight,
    Clock,
    Code,
    Gamepad2,
    History,
    ListOrdered,
    MessageSquare,
    Terminal,
    Tag,
    UserCircle2,
} from "lucide-react";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import {
    saveIssueWorkflow,
    setAssignee,
    toggleIssueResolved,
    updateIssueDiscordPost,
} from "@/app/actions";
import CommentForm from "./components/CommentForm";
import DeleteIssueForm from "./components/DeleteIssueForm";
import { EditIssueDetailsForm } from "./components/EditIssueDetailsForm";
import { SubtasksPanel, type SubtaskRow } from "./components/SubtasksPanel";
import { IssueLinksPanel, type LinkedIssueRow } from "./components/IssueLinksPanel";
import { IssueCommentCard } from "./components/IssueCommentCard";
import { getStaffUsers } from "@/lib/staff";
import {
    canAssignIssues,
    canDeleteIssues,
    canManageNote,
    getPermissionContext,
} from "@/lib/permissions";
import { syncIssueNotesFromDiscord } from "@/lib/discordSync";
import { formatIssueRef } from "@/lib/issue-ids";
import { SITE_NAME } from "@/lib/site";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Section, Meta, EmptyState } from "@/components/ui/Section";
import { Avatar } from "@/components/ui/Avatar";
import {
    PriorityBadge,
    SeverityBadge,
    StatusBadge,
    TypeBadge,
} from "@/components/views/DataGrid";
import {
    normalizePriority,
    normalizeSeverity,
    normalizeStatus,
    normalizeType,
    type IssueLinkType,
    type IssueStatus,
} from "@/lib/issue-tokens";
import { WorkflowFields } from "./components/WorkflowFields";
import { AssigneeSelect } from "./components/AssigneeSelect";
import { IssueActivityTimeline } from "./components/IssueActivityTimeline";

export default async function IssueDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    const resolvedParams = await params;
    const rawRef = resolvedParams.id;
    const normalizedRef = rawRef.replace(/^#/, "").toLowerCase();

    // Match either the short publicKey or the internal cuid so direct DB links still work.
    const issue = await db.issue.findFirst({
        where: { OR: [{ publicKey: normalizedRef }, { id: rawRef }] },
        include: {
            reporter: true,
            assignee: true,
            parentIssue: { select: { id: true, publicKey: true, title: true } },
            subtasks: {
                select: {
                    id: true,
                    publicKey: true,
                    title: true,
                    status: true,
                    priority: true,
                    type: true,
                },
                orderBy: { createdAt: "asc" },
            },
            outgoingLinks: {
                include: {
                    target: {
                        select: { id: true, publicKey: true, title: true, status: true },
                    },
                },
            },
            notes: {
                include: { author: true },
                orderBy: { createdAt: "asc" },
            },
        },
    });

    if (!issue) notFound();

    const publicIssueRef = formatIssueRef(issue.publicKey, issue.id);
    if (rawRef !== publicIssueRef) {
        redirect(`/issues/${publicIssueRef}`);
    }

    try {
        await syncIssueNotesFromDiscord(issue.id);
    } catch (error) {
        console.error("Failed to sync Discord notes for issue", issue.id, error);
    }

    const assignableUsers = await getStaffUsers();
    const permissionContext = await getPermissionContext(session?.user?.id);
    const canEdit = !!session?.user?.id;
    const canAssign = canAssignIssues(permissionContext);
    const canDelete = canDeleteIssues(permissionContext);

    const workflowType = normalizeType(issue.type);
    const workflowPriority = normalizePriority(issue.priority);
    const workflowSeverity = normalizeSeverity(issue.severity);
    const workflowStatus = normalizeStatus(issue.status);

    const subtasks: SubtaskRow[] = (issue as any).subtasks.map((s: any) => ({
        id: s.id,
        issueRef: formatIssueRef(s.publicKey, s.id),
        title: s.title,
        status: normalizeStatus(s.status),
        priority: normalizePriority(s.priority),
        type: normalizeType(s.type),
    }));

    const links: LinkedIssueRow[] = ((issue as any).outgoingLinks || []).map((l: any) => ({
        linkId: l.id,
        type: l.type as IssueLinkType,
        targetId: l.target.id,
        targetIssueRef: formatIssueRef(l.target.publicKey, l.target.id),
        targetTitle: l.target.title,
        targetStatus: normalizeStatus(l.target.status) as IssueStatus,
    }));

    const parentRef = (issue as any).parentIssue
        ? formatIssueRef(
              (issue as any).parentIssue.publicKey,
              (issue as any).parentIssue.id
          )
        : null;

    return (
        <div className="flex flex-col md:h-full md:min-h-0 md:flex-row md:overflow-hidden">
            {/* Main column */}
            <div className="min-w-0 md:flex-1 md:overflow-y-auto md:border-r md:border-border">
                <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{SITE_NAME}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>Issues</span>
                        {parentRef && (
                            <>
                                <ChevronRight className="h-3 w-3" />
                                <a
                                    href={`/issues/${parentRef}`}
                                    className="font-mono hover:text-primary transition-colors"
                                >
                                    {parentRef}
                                </a>
                            </>
                        )}
                        <ChevronRight className="h-3 w-3" />
                        <span className="font-mono text-primary">{publicIssueRef}</span>
                    </div>

                    {/* Title + badges */}
                    <div className="space-y-3">
                        <h1 className="text-2xl font-semibold leading-tight text-foreground">
                            {issue.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={workflowStatus} />
                            <PriorityBadge priority={workflowPriority} />
                            <TypeBadge type={workflowType} />
                            <SeverityBadge severity={workflowSeverity} />
                            {issue.storyPoints != null && (
                                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 h-6 text-[11px] font-medium text-muted-foreground">
                                    {issue.storyPoints} pts
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    {issue.description && (
                        <div className="rounded-md border border-border bg-surface">
                            <div className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Description
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                {issue.description}
                            </div>
                        </div>
                    )}

                    {/* Resource + version */}
                    {(issue.resourceName || issue.serverVersion) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {issue.resourceName && (
                                <div className="rounded-md border border-border bg-surface p-3">
                                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        <Code className="h-3 w-3" /> Resource
                                    </div>
                                    <p className="font-mono text-xs text-foreground">{issue.resourceName}</p>
                                </div>
                            )}
                            {issue.serverVersion && (
                                <div className="rounded-md border border-border bg-surface p-3">
                                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        <Gamepad2 className="h-3 w-3" /> Server / build
                                    </div>
                                    <p className="font-mono text-xs text-foreground">{issue.serverVersion}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {issue.reproductionSteps && (
                        <div className="rounded-md border border-warning/30 bg-warning/5">
                            <div className="flex items-center gap-1.5 border-b border-warning/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-warning">
                                <ListOrdered className="h-3 w-3" /> Steps to reproduce
                            </div>
                            <p className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                {issue.reproductionSteps}
                            </p>
                        </div>
                    )}

                    {issue.expectedBehavior && (
                        <div className="rounded-md border border-success/30 bg-success/5">
                            <div className="border-b border-success/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-success">
                                Expected behavior
                            </div>
                            <p className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                {issue.expectedBehavior}
                            </p>
                        </div>
                    )}

                    {canEdit && (
                        <EditIssueDetailsForm
                            issue={{
                                id: issue.id,
                                title: issue.title,
                                description: issue.description,
                                priority: issue.priority,
                                severity: issue.severity,
                                tags: issue.tags,
                                label: issue.label,
                                dueDate: issue.dueDate,
                                storyPoints: issue.storyPoints,
                                resourceName: issue.resourceName,
                                serverVersion: issue.serverVersion,
                                reproductionSteps: issue.reproductionSteps,
                                expectedBehavior: issue.expectedBehavior,
                                environment: issue.environment,
                            }}
                        />
                    )}

                    {/* Activity */}
                    <div className="space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            Activity
                            <span className="text-[11px] font-normal text-muted-foreground">
                                {issue.notes.length} comment{issue.notes.length === 1 ? "" : "s"}
                            </span>
                        </h3>

                        <div className="space-y-3">
                            {issue.notes.map((note: any) => (
                                <IssueCommentCard
                                    key={note.id}
                                    issueId={issue.id}
                                    canManage={canManageNote(permissionContext, note.authorId)}
                                    note={{
                                        id: note.id,
                                        content: note.content,
                                        createdAt: note.createdAt.toISOString(),
                                        source: note.source,
                                        author: {
                                            id: note.author.id,
                                            name: note.author.name,
                                            image: note.author.image,
                                        },
                                    }}
                                />
                            ))}
                            {issue.notes.length === 0 && (
                                <EmptyState
                                    icon={<MessageSquare className="h-5 w-5" />}
                                    title="No activity yet"
                                    description="Be the first to comment, link an issue, or add a subtask."
                                />
                            )}
                        </div>

                        {canEdit && (
                            <CommentForm
                                issueId={issue.id}
                                currentUserImage={session?.user?.image || null}
                                users={assignableUsers}
                            />
                        )}
                    </div>

                    <div className="space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <History className="h-4 w-4 text-muted-foreground" />
                            Change log
                        </h3>
                        <IssueActivityTimeline issueId={issue.id} />
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <aside className="w-full shrink-0 border-t border-border bg-surface/30 p-4 md:w-80 md:border-t-0 md:border-l md:overflow-y-auto">
                <div className="space-y-3">
                    <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Properties
                    </h3>

                    {canEdit && (
                        <Section title="Workflow" defaultOpen>
                            <WorkflowFields
                                issueId={issue.id}
                                defaultType={workflowType}
                                defaultPriority={workflowPriority}
                                defaultSeverity={workflowSeverity}
                                defaultStatus={workflowStatus}
                            />
                        </Section>
                    )}

                    {canEdit && canAssign && (
                        <Section title="Assignee" defaultOpen>
                            <AssigneeSelect
                                issueId={issue.id}
                                defaultValue={issue.assigneeId ?? "none"}
                                users={assignableUsers}
                            />
                        </Section>
                    )}

                    <Section title="People" defaultOpen>
                        <div className="space-y-3">
                            <Meta label="Reporter">
                                <div className="flex items-center gap-2">
                                    <Avatar
                                        src={issue.reporter?.image}
                                        name={issue.reporter?.name}
                                        size="sm"
                                    />
                                    <span className="text-sm">
                                        {issue.reporter?.name || (
                                            <span className="text-subtle-foreground">Unknown</span>
                                        )}
                                    </span>
                                </div>
                            </Meta>

                            <Meta label="Assignee">
                                {issue.assignee ? (
                                    <div className="flex items-center gap-2">
                                        <Avatar
                                            src={issue.assignee.image}
                                            name={issue.assignee.name}
                                            size="sm"
                                        />
                                        <span className="text-sm">{issue.assignee.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-subtle-foreground">Unassigned</span>
                                )}
                            </Meta>
                        </div>
                    </Section>

                    <SubtasksPanel
                        parentIssueId={issue.id}
                        subtasks={subtasks}
                        canEdit={canEdit && !(issue as any).parentIssueId}
                    />

                    <IssueLinksPanel sourceId={issue.id} links={links} canEdit={canEdit} />

                    {canEdit && (
                        <Section title="Resolve" defaultOpen>
                            <form
                                action={toggleIssueResolved}
                                className="flex items-center justify-between gap-2"
                            >
                                <input type="hidden" name="issueId" value={issue.id} />
                                <input
                                    type="hidden"
                                    name="resolved"
                                    value={workflowStatus === "DONE" ? "false" : "true"}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    {workflowStatus === "DONE"
                                        ? "Issue is resolved."
                                        : "Mark as resolved."}
                                </p>
                                <Button
                                    type="submit"
                                    variant={workflowStatus === "DONE" ? "outline" : "success"}
                                    size="xs"
                                >
                                    {workflowStatus === "DONE" ? "Reopen" : "Resolve"}
                                </Button>
                            </form>
                        </Section>
                    )}

                    <Section title="Core info">
                        <div className="space-y-3">
                            {issue.dueDate && (
                                <Meta label="Due date">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        {new Intl.DateTimeFormat("en-US", {
                                            dateStyle: "medium",
                                        }).format(issue.dueDate)}
                                    </div>
                                </Meta>
                            )}

                            {(issue.tags || issue.label) && (
                                <Meta
                                    label={`Tags${issue.label ? ` · ${issue.label}` : ""}`}
                                >
                                    {issue.tags ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {issue.tags.split(",").map((tag: string) => {
                                                const t = tag.trim();
                                                if (!t) return null;
                                                return (
                                                    <span
                                                        key={t}
                                                        className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                                    >
                                                        <Tag className="h-2.5 w-2.5 opacity-70" />
                                                        {t}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-subtle-foreground">—</span>
                                    )}
                                </Meta>
                            )}
                        </div>
                    </Section>

                    <Section title="Debug & integrations" defaultOpen={false}>
                        <div className="space-y-3">
                            {issue.environment && (
                                <Meta label="Environment">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="truncate" title={issue.environment}>
                                            {issue.environment}
                                        </span>
                                    </div>
                                </Meta>
                            )}

                            <Meta label="Discord forum post">
                                <form action={updateIssueDiscordPost} className="space-y-2">
                                    <input type="hidden" name="issueId" value={issue.id} />
                                    <Input
                                        name="discordPostId"
                                        defaultValue={issue.discordThreadId || ""}
                                        placeholder="Paste post link or post ID"
                                        className="font-mono text-xs"
                                    />
                                    <Button type="submit" size="xs" variant="outline">
                                        Save post link
                                    </Button>
                                </form>
                                {issue.discordThreadId && (
                                    <p className="mt-2 text-[10px] font-mono break-all text-muted-foreground">
                                        Post ID: {issue.discordThreadId}
                                    </p>
                                )}
                            </Meta>
                        </div>
                    </Section>

                    <Section title="Timeline" defaultOpen={false}>
                        <div className="space-y-3">
                            <Meta label="Created">
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    {new Intl.DateTimeFormat("en-US", {
                                        dateStyle: "medium",
                                    }).format(issue.createdAt)}
                                </div>
                            </Meta>
                            <Meta label="Updated">
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    {new Intl.DateTimeFormat("en-US", {
                                        dateStyle: "medium",
                                    }).format(issue.updatedAt)}
                                </div>
                            </Meta>
                        </div>
                    </Section>

                    {canEdit && canDelete && (
                        <Section title="Danger zone" defaultOpen={false}>
                            <DeleteIssueForm issueId={issue.id} />
                        </Section>
                    )}
                </div>
            </aside>
        </div>
    );
}
