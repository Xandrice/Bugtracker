import { StatusIcon, PriorityIcon, TypeIcon, priorityLabels, statusStyles, typeStyles } from "@/components/views/DataGrid"
import { Calendar, Clock, ChevronRight, UserCircle2, MessageSquare, AlertCircle, Terminal, Tag, Code, Gamepad2, ListOrdered, Target } from "lucide-react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { auth } from "@/../auth"
import { saveIssueWorkflow, setAssignee, toggleIssueResolved, updateIssueDiscordPost } from "@/app/actions"
import CommentForm from "./components/CommentForm"
import DeleteIssueForm from "./components/DeleteIssueForm"
import { getStaffUsers } from "@/lib/staff"
import { syncIssueNotesFromDiscord } from "@/lib/discordSync"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default async function IssueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const resolvedParams = await params;

    // Pull latest Discord thread replies into notes for linked issues.
    try {
        await syncIssueNotesFromDiscord(resolvedParams.id);
    } catch (error) {
        console.error("Failed to sync Discord notes for issue", resolvedParams.id, error);
    }

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
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto border-r border-border/50 bg-transparent">
                <div className="px-6 py-5 max-w-4xl w-full mx-auto space-y-6">

                    <div className="gta-hero space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-display text-sm uppercase tracking-[0.14em]">Renegade Roleplay</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span className="font-mono text-primary">{issue.id.slice(-8)}</span>
                        </div>

                        <h1 className="gta-heading text-3xl leading-tight">
                            {issue.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${statusStyles[issue.status as keyof typeof statusStyles] || "bg-muted"}`}>
                                <StatusIcon status={issue.status as any} /> {issue.status.replace("_", " ")}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                <PriorityIcon priority={issue.priority as any} /> {priorityLabels[issue.priority as keyof typeof priorityLabels] || issue.priority}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${typeStyles[issue.type as keyof typeof typeStyles] || "bg-muted"}`}>
                                <TypeIcon type={issue.type as any} /> {issue.type}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                                <AlertCircle className="h-3.5 w-3.5" /> {issue.severity}
                            </span>
                            {issue.storyPoints != null && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-muted">
                                    <Target className="h-3.5 w-3.5" /> {issue.storyPoints} pts
                                </span>
                            )}
                        </div>
                    </div>

                    {issue.description && (
                        <div className="gta-surface p-5 text-sm">
                            <h3 className="font-semibold text-muted-foreground mb-3 text-xs uppercase tracking-wider">Description</h3>
                            <p className="leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                        </div>
                    )}

                    {(issue.resourceName || issue.serverVersion) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {issue.resourceName && (
                                <div className="gta-surface bg-primary/5 border-primary/20 p-4">
                                    <h3 className="font-semibold text-muted-foreground mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Code className="h-4 w-4 text-primary" /> Resource
                                    </h3>
                                    <p className="font-mono text-sm">{issue.resourceName}</p>
                                </div>
                            )}
                            {issue.serverVersion && (
                                <div className="gta-surface bg-primary/5 border-primary/20 p-4">
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
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{note.author.name || "Unknown User"}</span>
                                                {note.source === "DISCORD" && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold tracking-wide">DISCORD</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground" title={note.createdAt.toISOString()}>
                                                {new Intl.DateTimeFormat("en-US", {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                }).format(note.createdAt)}
                                            </span>
                                        </div>
                                        <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-code:before:content-[''] prose-code:after:content-['']">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {note.content}
                                            </ReactMarkdown>
                                        </div>
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

            <div className="w-full md:w-72 border-l border-border bg-background/80 p-4 flex flex-col gap-3 shrink-0 overflow-y-auto">
                <h3 className="font-display text-lg uppercase tracking-[0.16em] text-muted-foreground">Properties</h3>

                <div className="space-y-2 text-sm">
                    <details open className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Workflow & Priority</summary>
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
                                    <option value="URGENT">{priorityLabels.URGENT}</option>
                                    <option value="HIGH">{priorityLabels.HIGH}</option>
                                    <option value="MEDIUM">{priorityLabels.MEDIUM}</option>
                                    <option value="LOW">{priorityLabels.LOW}</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    name="severity"
                                    defaultValue={issue.severity}
                                    className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="MINOR">Minor (1-5 affected)</option>
                                    <option value="MAJOR">Major (6-20 affected)</option>
                                    <option value="CRITICAL">Critical (21+ affected)</option>
                                    <option value="BLOCKER">Blocker (Most/All affected)</option>
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
                    </details>

                    <details open className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Assignee</summary>
                        <form action={setAssignee} className="flex flex-col gap-2 mt-2">
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
                    </details>

                    <details open className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Resolve</summary>
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
                    </details>

                    <details open className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Core Info</summary>
                        <div className="space-y-3 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-muted-foreground text-xs">Reporter</span>
                                <div className="flex items-center gap-2 font-medium">
                                    {issue.reporter ? (
                                        <>
                                            {issue.reporter.image ? (
                                                <img src={issue.reporter.image} alt={issue.reporter.name || "Reporter"} className="w-5 h-5 rounded-full border object-cover" />
                                            ) : (
                                                <UserCircle2 className="w-5 h-5 text-muted-foreground" />
                                            )}
                                            <span className="text-sm">{issue.reporter.name}</span>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground italic text-sm">Unknown</span>
                                    )}
                                </div>
                            </div>

                            {issue.dueDate && (
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-muted-foreground text-xs">Due date</span>
                                    <div className="flex items-center gap-2 font-medium text-sm">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(issue.dueDate)}
                                    </div>
                                </div>
                            )}

                            {(issue.tags || issue.label) && (
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-muted-foreground text-xs">Tags {issue.label && `· ${issue.label}`}</span>
                                    {issue.tags && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {issue.tags.split(',').map((tag: string) => {
                                                const t = tag.trim();
                                                if (!t) return null;
                                                return (
                                                    <span key={t} className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium flex items-center">
                                                        <Tag className="h-3 w-3 mr-1 opacity-70" />
                                                        {t}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </details>

                    <details className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Debug & Integrations</summary>
                        <div className="space-y-3 mt-2">
                            {issue.environment && (
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-muted-foreground text-xs">Environment</span>
                                    <div className="flex items-center gap-2 font-medium text-sm">
                                        <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate" title={issue.environment}>{issue.environment}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <span className="text-muted-foreground text-xs font-medium">Discord forum post</span>
                                <form action={updateIssueDiscordPost} className="flex flex-col gap-2">
                                    <input type="hidden" name="issueId" value={issue.id} />
                                    <input
                                        type="text"
                                        name="discordPostId"
                                        defaultValue={issue.discordThreadId || ""}
                                        className="w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Paste post link or post ID"
                                    />
                                    <button type="submit" className="text-xs font-medium text-primary hover:underline">Save post link</button>
                                </form>
                                {issue.discordThreadId && (
                                    <div className="text-[11px] font-mono break-all">Post ID: {issue.discordThreadId}</div>
                                )}
                                {issue.discordMessageId && (
                                    <div className="text-[11px] font-mono break-all">Notice Message: {issue.discordMessageId}</div>
                                )}
                            </div>
                        </div>
                    </details>

                    <details className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Timeline</summary>
                        <div className="space-y-3 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-muted-foreground text-xs">Created</span>
                                <div className="flex items-center gap-2 font-medium text-sm">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(issue.createdAt)}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-muted-foreground text-xs">Updated</span>
                                <div className="flex items-center gap-2 font-medium text-sm" title={issue.updatedAt.toLocaleString()}>
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                                        Math.round((issue.updatedAt.getTime() - Date.now()) / 86400000) === 0 ? 0 : Math.round((issue.updatedAt.getTime() - Date.now()) / 86400000), 'day'
                                    )}
                                </div>
                            </div>
                        </div>
                    </details>

                    <details className="gta-surface p-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-[0.1em] text-muted-foreground font-semibold">Danger Zone</summary>
                        <div className="mt-2">
                            <DeleteIssueForm issueId={issue.id} />
                        </div>
                    </details>
                </div>
            </div>

        </div>
    )
}
