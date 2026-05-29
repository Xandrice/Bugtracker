import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Send, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { createTeamNote, deleteTeamReply, deleteTeamThread } from "@/app/actions";
import {
    getNoteThreadCategoryLabel,
    normalizeNoteThreadCategory,
} from "@/lib/note-categories";
import { canManageNote, getNotePermissionContext } from "@/lib/note-permissions";
import { PageContainer } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { MarkdownContent } from "@/components/ui/MarkdownContent";

function formatDate(value: Date) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(value);
}

export default async function NoteThreadPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();

    const thread = await db.note.findFirst({
        where: { id, issueId: null, isThread: true, parentId: null },
        include: {
            author: true,
            replies: { include: { author: true }, orderBy: { createdAt: "asc" } },
        },
    });

    if (!thread) notFound();

    const permissionContext = await getNotePermissionContext(session?.user?.id);
    const canManageThread = canManageNote(permissionContext, thread.authorId);

    return (
        <PageContainer className="max-w-3xl">
            <Link
                href={`/notes?category=${normalizeNoteThreadCategory(thread.category)}`}
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to folder
            </Link>

            <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-2xl font-semibold leading-tight text-foreground">
                        {thread.title}
                    </h1>
                    <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {getNoteThreadCategoryLabel(thread.category)}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Started by{" "}
                    <span className="text-foreground">{thread.author?.name || "Unknown"}</span>{" "}
                    on {formatDate(thread.createdAt)}
                </p>
                {canManageThread && (
                    <div className="flex items-center gap-1.5 pt-1">
                        <Link
                            href={`/notes/${thread.id}/edit`}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            <Pencil className="h-3 w-3" />
                            Edit
                        </Link>
                        <form action={deleteTeamThread}>
                            <input type="hidden" name="threadId" value={thread.id} />
                            <Button type="submit" variant="danger" size="xs">
                                <Trash2 className="h-3 w-3" />
                                Delete
                            </Button>
                        </form>
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Avatar src={thread.author?.image} name={thread.author?.name} size="sm" />
                        <CardTitle className="text-xs">{thread.author?.name || "Unknown"}</CardTitle>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                        {formatDate(thread.createdAt)}
                    </span>
                </CardHeader>
                <CardBody>
                    <MarkdownContent content={thread.content} />
                </CardBody>
            </Card>

            <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Replies
                    <span className="text-[11px] font-normal text-muted-foreground">
                        {thread.replies.length}
                    </span>
                </h3>
                {thread.replies.map((reply) => (
                    <Card key={reply.id}>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Avatar src={reply.author?.image} name={reply.author?.name} size="sm" />
                                <CardTitle className="text-xs">
                                    {reply.author?.name || "Unknown"}
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                    {formatDate(reply.createdAt)}
                                </span>
                                {canManageNote(permissionContext, reply.authorId) && (
                                    <form action={deleteTeamReply}>
                                        <input type="hidden" name="replyId" value={reply.id} />
                                        <input type="hidden" name="threadId" value={thread.id} />
                                        <button
                                            type="submit"
                                            className="text-subtle-foreground transition-colors hover:text-danger"
                                            title="Delete reply"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </form>
                                )}
                            </div>
                        </CardHeader>
                        <CardBody>
                            <MarkdownContent content={reply.content} />
                        </CardBody>
                    </Card>
                ))}
            </div>

            {session?.user?.id ? (
                <Card>
                    <form action={createTeamNote}>
                        <input type="hidden" name="threadId" value={thread.id} />
                        <CardHeader>
                            <CardTitle className="text-xs">Reply</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-2">
                            <textarea
                                id="content"
                                name="content"
                                required
                                minLength={2}
                                className="block w-full resize-y rounded-md border border-input bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus-ring min-h-[100px]"
                                placeholder="Share an update, question, or follow-up…"
                            />
                            <div className="flex justify-end">
                                <Button type="submit" variant="primary" size="sm">
                                    <Send className="h-3 w-3" />
                                    Post reply
                                </Button>
                            </div>
                        </CardBody>
                    </form>
                </Card>
            ) : (
                <Card>
                    <CardBody className="text-sm text-muted-foreground">
                        Sign in to join this thread.
                    </CardBody>
                </Card>
            )}
        </PageContainer>
    );
}
