import { StatusIcon, PriorityIcon, TypeIcon, statusStyles, typeStyles } from "@/components/views/DataGrid"
import { Calendar, Clock, ChevronRight, UserCircle2, MessageSquare, AlertCircle, Terminal, Tag, Code, Gamepad2, ListOrdered, Target } from "lucide-react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { auth } from "@/../auth"
import { saveIssueWorkflow, setAssignee, toggleIssueResolved } from "@/app/actions"
import CommentForm from "./components/CommentForm"
import { getStaffUsers } from "@/lib/staff"

export default async function IssueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const resolvedParams = await params;

    const issue: any = await db.issue.findUnique({
        where: { id: resolvedParams.id },
        include: {
            reporter: true,
            assignee: true,
            notes: {
                include: { author: true },
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!issue) {
        notFound();
    }

    const assignableUsers = await getStaffUsers();

    return (
        <div className="flex flex-col h-full overflow-hidden flex-1 md:flex-row">
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto border-r border-border/50 bg-background/50">
                <div className="px-8 py-6 max-w-4xl w-full mx-auto space-y-8">

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono font-medium">FiveM Tracker</span>
                            <ChevronRight className="h-4 w-4" />
                            <span className="font-mono text-primary">{issue.id.slice(-8)}</span>
                        </div>

                        <h1 className="text-3xl font-bold tracking-tight leading-tight">
                            {issue.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium ${statusStyles[issue.status as keyof typeof statusStyles] || "bg-muted"}`}>
                                <StatusIcon status={issue.status as any} /> {issue.status.replace("_", " ")}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                <PriorityIcon priority={issue.priority as any} /> {issue.priority}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium ${typeStyles[issue.type as keyof typeof typeStyles] || "bg-muted"}`}>
                                <TypeIcon type={issue.type as any} /> {issue.type}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                                <AlertCircle className="h-4 w-4" /> {issue.severity}
                            </span>
                            {issue.storyPoints != null && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium bg-muted">
                                    <Target className="h-4 w-4" /> {issue.storyPoints} pts
                                </span>
                            )}
                        </div>
                    </div>

                    {issue.description && (
                        <div className="bg-background border border-border rounded-xl p-5 shadow-sm text-sm">
                            <h3 className="font-semibold text-muted-foreground mb-3 text-xs uppercase tracking-wider">Description</h3>
                            <p className="leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                        </div>
                    )}

                    {(issue.resourceName || issue.serverVersion) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {issue.resourceName && (
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                                    <h3 className="font-semibold text-muted-foreground mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Code className="h-4 w-4 text-primary" /> Resource
                                    </h3>
                                    <p className="font-mono text-sm">{issue.resourceName}</p>
                                </div>
                            )}
                            {issue.serverVersion && (
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                                    <h3 className="font-semibold text-muted-foreground mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Gamepad2 className="h-4 w-4 text-primary" /> Server / Build
                                    </h3>
                                    <p className="font-mono text-sm">{issue.serverVersion}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {issue.reproductionSteps && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                            <h3 className="font-semibold text-muted-foreground mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
                                <ListOrdered className="h-4 w-4 text-amber-600" /> Steps to reproduce
                            </h3>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{issue.reproductionSteps}</p>
                        </div>
                    )}

                    {issue.expectedBehavior && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                            <h3 className="font-semibold text-muted-foreground mb-3 text-xs uppercase tracking-wider">Expected behavior</h3>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{issue.expectedBehavior}</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Notes & Activity
                        </h3>

                        <div className="space-y-4">
                            {issue.notes.map((note: any) => (
                                <div key={note.id} className="flex gap-4 group">
                                    <div className="shrink-0 mt-1">
                                        {note.author.image ? (
                                            <img src={note.author.image} alt={note.author.name || "User"} className="w-8 h-8 rounded-full border object-cover" />
                                        ) : (
                                            <UserCircle2 className="w-8 h-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 bg-muted/30 border border-border rounded-xl p-4 transition-colors group-hover:bg-muted/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-sm">{note.author.name || "Unknown User"}</span>
                                            <span className="text-xs text-muted-foreground" title={note.createdAt.toLocaleString()}>
                                                {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                                                    Math.round((note.createdAt.getTime() - Date.now()) / 86400000) === 0 ? 0 : Math.round((note.createdAt.getTime() - Date.now()) / 86400000), 'day'
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {note.content.split(/(@\w+)/g).map((part: string, i: number) =>
                                                part.startsWith('@') ? <span key={i} className="text-primary bg-primary/10 px-1 py-0.5 rounded font-medium">{part}</span> : part
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {issue.notes.length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-6 rounded-xl border border-dashed border-border">No notes yet. Be the first to comment!</div>
                            )}
                        </div>

                        <CommentForm
                            issueId={issue.id}
                            currentUserImage={session?.user?.image || null}
                            users={assignableUsers}
                        />

                    </div>

                </div>
            </div>

            <div className="w-full md:w-80 border-l border-border bg-background/80 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Properties</h3>

                <div className="space-y-4 text-sm">
                    <div className="flex flex-col gap-2 border-b border-border pb-4">
                        <span className="text-muted-foreground font-medium">Workflow</span>
                        <form action={saveIssueWorkflow} className="space-y-2">
                            <input type="hidden" name="issueId" value={issue.id} />
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    name="type"
                                    defaultValue={issue.type}
                                    className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="BUG">Bug</option>
                                    <option value="FEATURE">Feature</option>
                                    <option value="TASK">Task</option>
                                </select>
                                <select
                                    name="priority"
                                    defaultValue={issue.priority}
                                    className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    name="severity"
                                    defaultValue={issue.severity}
                                    className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="MINOR">Minor</option>
                                    <option value="MAJOR">Major</option>
                                    <option value="CRITICAL">Critical</option>
                                    <option value="BLOCKER">Blocker</option>
                                </select>
                                <select
                                    name="status"
                                    defaultValue={issue.status}
                                    className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="REVIEW">Review</option>
                                    <option value="DONE">Done</option>
                                </select>
                            </div>
                            <button type="submit" className="text-xs font-medium text-primary hover:underline">Save workflow fields</button>
                        </form>
                    </div>

                    <div className="flex flex-col gap-2 border-b border-border pb-4">
                        <span className="text-muted-foreground font-medium">Resolve</span>
                        <form action={toggleIssueResolved} className="flex items-center justify-between gap-2">
                            <input type="hidden" name="issueId" value={issue.id} />
                            <input type="hidden" name="resolved" value={issue.status === "DONE" ? "false" : "true"} />
                            <span className="text-xs text-muted-foreground">
                                {issue.status === "DONE" ? "Issue is currently resolved." : "Mark issue as resolved when finished."}
                            </span>
                            <button
                                type="submit"
                                className="text-xs rounded-md px-2.5 py-1.5 border transition-colors border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                            >
                                {issue.status === "DONE" ? "Reopen" : "Resolve"}
                            </button>
                        </form>
                    </div>

                    <div className="flex flex-col gap-2 border-b border-border pb-4">
                        <span className="text-muted-foreground font-medium">Assignee</span>
                        <form action={setAssignee} className="flex flex-col gap-2">
                            <input type="hidden" name="issueId" value={issue.id} />
                            <select
                                name="assigneeId"
                                defaultValue={issue.assigneeId ?? "none"}
                                className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="none">Unassigned</option>
                                {assignableUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name || u.id}</option>
                                ))}
                            </select>
                            <button type="submit" className="text-xs font-medium text-primary hover:underline">Update assignee</button>
                        </form>
                    </div>

                    <div className="flex flex-col gap-2 border-b border-border pb-4">
                        <span className="text-muted-foreground">Reporter</span>
                        <div className="flex items-center gap-2 font-medium">
                            {issue.reporter ? (
                                <>
                                    {issue.reporter.image ? (
                                        <img src={issue.reporter.image} alt={issue.reporter.name || "Reporter"} className="w-6 h-6 rounded-full border object-cover" />
                                    ) : (
                                        <UserCircle2 className="w-6 h-6 text-muted-foreground" />
                                    )}
                                    {issue.reporter.name}
                                </>
                            ) : (
                                <span className="text-muted-foreground italic">Unknown</span>
                            )}
                        </div>
                    </div>

                    {issue.dueDate && (
                        <div className="flex flex-col gap-2 border-b border-border pb-4">
                            <span className="text-muted-foreground">Due date</span>
                            <div className="flex items-center gap-2 font-medium">
                                <Calendar className="h-4 w-4 text-primary" />
                                {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(issue.dueDate)}
                            </div>
                        </div>
                    )}

                    {issue.environment && (
                        <div className="flex flex-col gap-2 border-b border-border pb-4">
                            <span className="text-muted-foreground">Environment</span>
                            <div className="flex items-center gap-2 font-medium">
                                <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate" title={issue.environment}>{issue.environment}</span>
                            </div>
                        </div>
                    )}

                    {(issue.tags || issue.label) && (
                        <div className="flex flex-col gap-2 border-b border-border pb-4">
                            <span className="text-muted-foreground">Tags {issue.label && `· ${issue.label}`}</span>
                            {issue.tags && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {issue.tags.split(',').map((tag: string) => {
                                        const t = tag.trim();
                                        if (!t) return null;
                                        return (
                                            <span key={t} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-medium flex items-center">
                                                <Tag className="h-3 w-3 mr-1 opacity-70" />
                                                {t}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-2 border-b border-border pb-4">
                        <span className="text-muted-foreground">Created</span>
                        <div className="flex items-center gap-2 font-medium">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(issue.createdAt)}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-muted-foreground">Updated</span>
                        <div className="flex items-center gap-2 font-medium" title={issue.updatedAt.toLocaleString()}>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                                Math.round((issue.updatedAt.getTime() - Date.now()) / 86400000) === 0 ? 0 : Math.round((issue.updatedAt.getTime() - Date.now()) / 86400000), 'day'
                            )}
                        </div>
                    </div>

                </div>
            </div>

        </div>
    )
}
