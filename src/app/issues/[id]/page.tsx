import {
    Calendar,
    ChevronRight,
    Clock,
    Code,
    Gamepad2,
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
import { canManageNote, getNotePermissionContext } from "@/lib/note-permissions";
import { syncIssueNotesFromDiscord } from "@/lib/discordSync";
import { formatIssueRef } from "@/lib/issue-ids";
import { SITE_NAME } from "@/lib/site";
import { Button, Input, Avatar } from "@heroui/react";
import { Section, Meta, EmptyState } from "@/components/ui/Section";
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
import { cn } from "@/components/ui/cn";

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
    const permissionContext = await getNotePermissionContext(session?.user?.id);
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

    const canEdit = !!session?.user?.id;
    const parentRef = (issue as any).parentIssue
        ? formatIssueRef(
              (issue as any).parentIssue.publicKey,
              (issue as any).parentIssue.id
          )
        : null;

    return (
        <div className="flex flex-col md:h-full md:min-h-0 md:flex-row md:overflow-hidden">
            {/* Main column */}
            <div className="min-w-0 md:flex-1 md:overflow-y-auto md:border-r md:border-default-100">
                <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-default-450 tracking-wide uppercase">
                        <span>{SITE_NAME}</span>
                        <ChevronRight className="h-3 w-3 text-default-400" />
                        <span>Issues</span>
                        {parentRef && (
                            <>
                                <ChevronRight className="h-3 w-3 text-default-400" />
                                <a
                                    href={`/issues/${parentRef}`}
                                    className="font-mono text-primary hover:underline transition-all"
                                >
                                    {parentRef}
                                </a>
                            </>
                        )}
                        <ChevronRight className="h-3 w-3 text-default-400" />
                        <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{publicIssueRef}</span>
                    </div>

                    {/* Title + badges */}
                    <div className="space-y-3">
                        <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-foreground">
                            {issue.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={workflowStatus} />
                            <PriorityBadge priority={workflowPriority} />
                            <TypeBadge type={workflowType} />
                            <SeverityBadge severity={workflowSeverity} />
                            {issue.storyPoints != null && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-default-100 bg-default-100/50 px-2.5 h-6 text-[11px] font-semibold text-foreground">
                                    {issue.storyPoints} pts
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    {issue.description && (
                        <div className="rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm overflow-hidden">
                            <div className="border-b border-default-100 px-5 py-3 text-xs font-bold uppercase tracking-wider text-default-450 bg-default-50/20">
                                Description
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                {issue.description}
                            </div>
                        </div>
                    )}

                    {/* Resource + version */}
                    {(issue.resourceName || issue.serverVersion) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {issue.resourceName && (
                                <div className="rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm p-4 hover:border-default-250 transition-colors flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-default-450">
                                        <Code className="h-3.5 w-3.5 text-primary" /> Resource
                                    </div>
                                    <p className="font-mono text-xs font-semibold text-foreground">{issue.resourceName}</p>
                                </div>
                            )}
                            {issue.serverVersion && (
                                <div className="rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm p-4 hover:border-default-250 transition-colors flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-default-450">
                                        <Gamepad2 className="h-3.5 w-3.5 text-primary" /> Server / build
                                    </div>
                                    <p className="font-mono text-xs font-semibold text-foreground">{issue.serverVersion}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {issue.reproductionSteps && (
                        <div className="rounded-xl border border-warning-200/30 bg-warning-50/5 backdrop-blur-md shadow-sm overflow-hidden">
                            <div className="flex items-center gap-1.5 border-b border-warning-200/20 px-5 py-3 text-xs font-bold uppercase tracking-wider text-warning">
                                <ListOrdered className="h-3.5 w-3.5" /> Steps to reproduce
                            </div>
                            <p className="p-5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                {issue.reproductionSteps}
                            </p>
                        </div>
                    )}

                    {issue.expectedBehavior && (
                        <div className="rounded-xl border border-success-200/30 bg-success-50/5 backdrop-blur-md shadow-sm overflow-hidden">
                            <div className="border-b border-success-200/20 px-5 py-3 text-xs font-bold uppercase tracking-wider text-success">
                                Expected behavior
                            </div>
                            <p className="p-5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
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
                        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <MessageSquare className="h-4 w-4 text-default-400" />
                            Activity
                            <span className="text-[11px] font-semibold text-default-450 bg-default-100/50 px-2 py-0.5 rounded-full">
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
                </div>
            </div>

            {/* Sidebar */}
            <aside className="w-full shrink-0 border-t border-default-100 bg-default-50/10 backdrop-blur-md p-5 md:w-80 md:border-t-0 md:border-l md:overflow-y-auto">
                <div className="space-y-4">
                    <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-default-450">
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

                    {canEdit && (
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
                                    <Avatar className="h-6 w-6 text-[11px] font-semibold shrink-0">
                                        {issue.reporter?.image && (
                                            <Avatar.Image src={issue.reporter.image} className="object-cover h-full w-full" />
                                        )}
                                        <Avatar.Fallback>{(issue.reporter?.name || "?").charAt(0).toUpperCase()}</Avatar.Fallback>
                                    </Avatar>
                                    <span className="text-sm font-semibold">
                                        {issue.reporter?.name || (
                                            <span className="text-default-400">Unknown</span>
                                        )}
                                    </span>
                                </div>
                            </Meta>

                            <Meta label="Assignee">
                                {issue.assignee ? (
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6 text-[11px] font-semibold shrink-0">
                                            {issue.assignee.image && (
                                                <Avatar.Image src={issue.assignee.image} className="object-cover h-full w-full" />
                                            )}
                                            <Avatar.Fallback>{(issue.assignee.name || "?").charAt(0).toUpperCase()}</Avatar.Fallback>
                                        </Avatar>
                                        <span className="text-sm font-semibold">{issue.assignee.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm font-semibold text-default-400">Unassigned</span>
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
                                <p className="text-xs font-medium text-default-450">
                                    {workflowStatus === "DONE"
                                        ? "Issue is resolved."
                                        : "Mark as resolved."}
                                </p>
                                <Button
                                    type="submit"
                                    variant={workflowStatus === "DONE" ? "outline" : "primary"}
                                    className={cn(
                                        "h-7 text-xs font-semibold px-2.5",
                                        workflowStatus !== "DONE" && "bg-success text-success-foreground hover:bg-success-600"
                                    )}
                                    size="sm"
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
                                    <div className="flex items-center gap-2 text-sm font-semibold">
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
                                                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary"
                                                    >
                                                        <Tag className="h-2.5 w-2.5 opacity-70" />
                                                        {t}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-sm font-semibold text-default-400">—</span>
                                    )}
                                </Meta>
                            )}
                        </div>
                    </Section>

                    <Section title="Debug & integrations" defaultOpen={false}>
                        <div className="space-y-3">
                            {issue.environment && (
                                <Meta label="Environment">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Terminal className="h-3.5 w-3.5 text-default-400" />
                                        <span className="truncate font-mono text-xs" title={issue.environment}>
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
                                        className="w-full h-8 px-2.5 bg-background/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-xs font-mono text-foreground transition-all"
                                    />
                                    <Button 
                                        type="submit" 
                                        size="sm" 
                                        variant="outline"
                                        className="h-7 text-xs font-semibold px-2.5"
                                    >
                                        Save post link
                                    </Button>
                                </form>
                                {issue.discordThreadId && (
                                    <p className="mt-2 text-[10px] font-mono break-all text-default-450 bg-default-100/50 p-2 rounded-lg border border-default-100">
                                        Post ID: {issue.discordThreadId}
                                    </p>
                                )}
                            </Meta>
                        </div>
                    </Section>

                    <Section title="Timeline" defaultOpen={false}>
                        <div className="space-y-3">
                            <Meta label="Created">
                                <div className="flex items-center gap-2 text-sm font-semibold text-default-450">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Intl.DateTimeFormat("en-US", {
                                        dateStyle: "medium",
                                    }).format(issue.createdAt)}
                                </div>
                            </Meta>
                            <Meta label="Updated">
                                <div className="flex items-center gap-2 text-sm font-semibold text-default-450">
                                    <Clock className="h-3.5 w-3.5" />
                                    {new Intl.DateTimeFormat("en-US", {
                                        dateStyle: "medium",
                                    }).format(issue.updatedAt)}
                                </div>
                            </Meta>
                        </div>
                    </Section>

                    {canEdit && (
                        <Section title="Danger zone" defaultOpen={false}>
                            <DeleteIssueForm issueId={issue.id} />
                        </Section>
                    )}
                </div>
            </aside>
        </div>
    );
}
