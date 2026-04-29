import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Send, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { createTeamNote, deleteTeamReply, deleteTeamThread } from "@/app/actions";
import { getNoteThreadCategoryLabel, normalizeNoteThreadCategory } from "@/lib/note-categories";
import { canManageNote, getNotePermissionContext } from "@/lib/note-permissions";

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
    where: {
      id,
      issueId: null,
      isThread: true,
      parentId: null,
    },
    include: {
      author: true,
      replies: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread) {
    notFound();
  }

  const permissionContext = await getNotePermissionContext(session?.user?.id);
  const canManageThread = canManageNote(permissionContext, thread.authorId);

  return (
    <div className="gta-page max-w-[1000px]">
      <div className="gta-hero flex flex-col gap-3">
        <Link
          href={`/notes?category=${normalizeNoteThreadCategory(thread.category)}`}
          className="relative z-10 inline-flex items-center gap-1.5 w-fit rounded-sm border border-border/70 bg-muted/45 px-2.5 py-1.5 leading-none text-[11px] font-semibold uppercase tracking-[0.08em] text-white/95 hover:text-white hover:border-primary/50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Back to folder
        </Link>
        <h1 className="gta-heading mt-1">{thread.title}</h1>
        <p className="gta-subheading">
          Started by {thread.author?.name || "Unknown"} on {formatDate(thread.createdAt)}
        </p>
        <div className="w-fit text-[10px] uppercase tracking-[0.12em] border border-border px-2 py-0.5 rounded text-muted-foreground">
          {getNoteThreadCategoryLabel(thread.category)}
        </div>
        {canManageThread && (
          <div className="flex items-center gap-2 pt-1">
            <Link href={`/notes/${thread.id}/edit`} className="gta-action">
              <Pencil className="h-3.5 w-3.5" />
              Edit Thread
            </Link>
            <form action={deleteTeamThread}>
              <input type="hidden" name="threadId" value={thread.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-all border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Thread
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="gta-surface p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          {thread.replies.length} replies
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{thread.content}</div>
      </div>

      <div className="space-y-3">
        {thread.replies.map((reply) => (
          <div key={reply.id} className="gta-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{reply.author?.name || "Unknown"}</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</div>
                {canManageNote(permissionContext, reply.authorId) && (
                  <form action={deleteTeamReply}>
                    <input type="hidden" name="replyId" value={reply.id} />
                    <input type="hidden" name="threadId" value={thread.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed mt-2">{reply.content}</div>
          </div>
        ))}
      </div>

      {session?.user?.id ? (
        <form action={createTeamNote} className="gta-surface p-5 space-y-3">
          <input type="hidden" name="threadId" value={thread.id} />
          <label htmlFor="content" className="text-sm font-medium leading-none">
            Reply
          </label>
          <textarea
            id="content"
            name="content"
            required
            minLength={2}
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
            placeholder="Share an update, question, or follow-up..."
          />
          <div className="flex justify-end">
            <button type="submit" className="gta-action">
              <Send className="h-3.5 w-3.5" />
              Post Reply
            </button>
          </div>
        </form>
      ) : (
        <div className="gta-surface p-4 text-sm text-muted-foreground">
          Sign in to join this thread.
        </div>
      )}
    </div>
  );
}
