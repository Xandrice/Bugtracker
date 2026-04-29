import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { updateTeamThread } from "@/app/actions";
import {
  NOTE_THREAD_CATEGORIES,
  normalizeNoteThreadCategory,
} from "@/lib/note-categories";
import { canManageNote, getNotePermissionContext } from "@/lib/note-permissions";

export default async function EditThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=/notes/${id}/edit`);
  }

  const thread = await db.note.findFirst({
    where: {
      id,
      issueId: null,
      isThread: true,
      parentId: null,
    },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      authorId: true,
    },
  });
  if (!thread) notFound();

  const permissionContext = await getNotePermissionContext(session.user.id);
  if (!canManageNote(permissionContext, thread.authorId)) {
    redirect(`/notes/${id}`);
  }

  return (
    <div className="gta-page max-w-3xl">
      <div className="gta-hero flex flex-col gap-2">
        <Link
          href={`/notes/${id}`}
          className="relative z-10 inline-flex items-center gap-1.5 w-fit rounded-sm border border-border/70 bg-muted/45 px-2.5 py-1.5 leading-none text-[11px] font-semibold uppercase tracking-[0.08em] text-white/95 hover:text-white hover:border-primary/50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Back to thread
        </Link>
        <h1 className="gta-heading mt-2">Edit Thread</h1>
        <p className="gta-subheading">Update title, folder, and content.</p>
      </div>

      <form action={updateTeamThread} className="space-y-6 gta-surface p-6 lg:p-8">
        <input type="hidden" name="threadId" value={thread.id} />

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium leading-none">
            Thread Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={thread.title || ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="category" className="text-sm font-medium leading-none">
            Folder
          </label>
          <select
            id="category"
            name="category"
            defaultValue={normalizeNoteThreadCategory(thread.category)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {NOTE_THREAD_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="content" className="text-sm font-medium leading-none">
            Content
          </label>
          <textarea
            id="content"
            name="content"
            defaultValue={thread.content}
            className="w-full min-h-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link
            href={`/notes/${id}`}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted h-10 px-4 py-2 border text-muted-foreground"
          >
            Cancel
          </Link>
          <button type="submit" className="gta-action">
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
