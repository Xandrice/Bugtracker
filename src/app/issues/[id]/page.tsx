import { StatusIcon, PriorityIcon, TypeIcon } from "@/components/views/DataGrid"
import { Calendar, Clock, Link as LinkIcon, Paperclip, ChevronRight, UserCircle2, Send, MessageSquare, AlertCircle, Terminal, Tag } from "lucide-react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { auth } from "@/../auth"
import { createTeamNote } from "@/app/actions"

export default async function IssueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const resolvedParams = await params;

    const issue = await db.issue.findUnique({
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

    return (
        <div className="flex flex-col h-full overflow-hidden flex-1 md:flex-row">
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto border-r border-border/50 bg-background/50">
                <div className="px-8 py-6 max-w-4xl w-full mx-auto space-y-8">

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">BugTracker</span>
                            <ChevronRight className="h-4 w-4" />
                            <span className="font-mono">{issue.id}</span>
                        </div>

                        <h1 className="text-3xl font-semibold tracking-tight leading-tight">
                            {issue.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 mt-4">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border text-sm font-medium">
                                <StatusIcon status={issue.status as any} /> {issue.status}
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border text-sm font-medium">
                                <PriorityIcon priority={issue.priority as any} /> {issue.priority}
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border text-sm font-medium">
                                <TypeIcon type={issue.type as any} /> {issue.type}
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border text-sm font-medium">
                                <AlertCircle className="h-4 w-4 text-rose-500" /> {issue.severity}
                            </span>
                        </div>
                    </div>

                    {issue.description && (
                        <div className="bg-background border rounded-lg p-5 shadow-sm text-sm">
                            <h3 className="font-medium text-muted-foreground mb-3 text-xs uppercase tracking-wider">Description</h3>
                            <p className="leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <h3 className="font-medium text-lg flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                            Notes & Activity
                        </h3>

                        <div className="space-y-4">
                            {issue.notes.map(note => (
                                <div key={note.id} className="flex gap-4 group">
                                    <div className="shrink-0 mt-1">
                                        {note.author.image ? (
                                            <img src={note.author.image} alt={note.author.name || "User"} className="w-8 h-8 rounded-full border object-cover" />
                                        ) : (
                                            <UserCircle2 className="w-8 h-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 bg-muted/30 border rounded-lg p-4 transition-colors group-hover:bg-muted/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-sm">{note.author.name || "Unknown User"}</span>
                                            <span className="text-xs text-muted-foreground" title={note.createdAt.toLocaleString()}>
                                                {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                                                    Math.round((note.createdAt.getTime() - Date.now()) / 86400000) === 0 ? 0 : Math.round((note.createdAt.getTime() - Date.now()) / 86400000), 'day'
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {note.content.split(/(@\w+)/g).map((part, i) =>
                                                part.startsWith('@') ? <span key={i} className="text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded font-medium">{part}</span> : part
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {issue.notes.length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-4">No notes yet. Be the first to comment!</div>
                            )}
                        </div>

                        {/* Comment Input */}
                        <form action={createTeamNote} className="flex gap-4 mt-6 items-start pt-6 border-t">
                            <input type="hidden" name="issueId" value={issue.id} />
                            <div className="shrink-0 mt-1">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="You" className="w-8 h-8 rounded-full border object-cover" />
                                ) : (
                                    <UserCircle2 className="w-8 h-8 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1 border rounded-lg shadow-sm bg-background overflow-hidden focus-within:ring-1 focus-within:ring-primary">
                                <textarea
                                    name="content"
                                    required
                                    placeholder="Add a note... Use @ to tag people"
                                    className="w-full min-h-[100px] p-4 text-sm resize-y focus:outline-none bg-transparent"
                                />
                                <div className="bg-muted/50 px-3 py-2 border-t flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <button type="button" className="p-1.5 text-muted-foreground hover:bg-muted rounded text-xs transition-colors"><Paperclip className="h-4 w-4" /></button>
                                        <button type="button" className="p-1.5 text-muted-foreground hover:bg-muted rounded text-xs transition-colors"><LinkIcon className="h-4 w-4" /></button>
                                    </div>
                                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors">
                                        <Send className="h-3.5 w-3.5" /> Comment
                                    </button>
                                </div>
                            </div>
                        </form>

                    </div>

                </div>
            </div>

            <div className="w-full md:w-80 border-l bg-background/50 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto hidden lg:flex">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Properties</h3>

                <div className="space-y-4 text-sm">
                    <div className="flex flex-col gap-2 border-b pb-4">
                        <span className="text-muted-foreground">Assignee</span>
                        <div className="flex items-center gap-2 font-medium">
                            {issue.assignee ? (
                                <>
                                    {issue.assignee.image ? (
                                        <img src={issue.assignee.image} alt={issue.assignee.name || "Assignee"} className="w-6 h-6 rounded-full border object-cover" />
                                    ) : (
                                        <UserCircle2 className="w-6 h-6 text-muted-foreground" />
                                    )}
                                    {issue.assignee.name}
                                </>
                            ) : (
                                <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 border-b pb-4">
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

                    {issue.environment && (
                        <div className="flex flex-col gap-2 border-b pb-4">
                            <span className="text-muted-foreground">Environment</span>
                            <div className="flex items-center gap-2 font-medium">
                                <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate" title={issue.environment}>{issue.environment}</span>
                            </div>
                        </div>
                    )}

                    {issue.tags && (
                        <div className="flex flex-col gap-2 border-b pb-4">
                            <span className="text-muted-foreground">Tags</span>
                            <div className="flex flex-wrap items-center gap-2">
                                {issue.tags.split(',').map((tag: string) => {
                                    const t = tag.trim();
                                    if (!t) return null;
                                    return (
                                        <span key={t} className="px-2 py-0.5 rounded-md bg-muted border text-xs font-medium flex items-center">
                                            <Tag className="h-3 w-3 mr-1 opacity-70" />
                                            {t}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 border-b pb-4">
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
