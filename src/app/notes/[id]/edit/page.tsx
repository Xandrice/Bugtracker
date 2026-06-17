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
import { PageContainer } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { discordSignInUrl } from "@/lib/auth-urls";

export default async function EditThreadPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        redirect(discordSignInUrl(`/notes/${id}/edit`));
    }

    const thread = await db.note.findFirst({
        where: { id, issueId: null, isThread: true, parentId: null },
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
        <PageContainer className="max-w-3xl">
            <Link
                href={`/notes/${id}`}
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to thread
            </Link>

            <form action={updateTeamThread}>
                <Card>
                    <CardHeader>
                        <div className="space-y-1">
                            <CardTitle>Edit thread</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Update title, folder, and content.
                            </p>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <input type="hidden" name="threadId" value={thread.id} />

                        <FieldRow label="Thread title" htmlFor="title">
                            <Input
                                id="title"
                                name="title"
                                defaultValue={thread.title || ""}
                                required
                            />
                        </FieldRow>

                        <FieldRow label="Folder" htmlFor="category">
                            {/*
                              Native select fallback for the edit form (server component)
                              themed to match our system colors via globals.css.
                            */}
                            <select
                                id="category"
                                name="category"
                                defaultValue={normalizeNoteThreadCategory(thread.category)}
                                className="h-9 w-full rounded-md border border-input bg-elevated px-3 text-sm focus-ring"
                            >
                                {NOTE_THREAD_CATEGORIES.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.label}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>

                        <FieldRow label="Content" htmlFor="content">
                            <Textarea
                                id="content"
                                name="content"
                                defaultValue={thread.content}
                                rows={10}
                                required
                            />
                        </FieldRow>
                    </CardBody>
                    <CardFooter>
                        <Link
                            href={`/notes/${id}`}
                            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 h-9 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            Cancel
                        </Link>
                        <Button type="submit" variant="primary" size="md">
                            <Save className="h-3.5 w-3.5" />
                            Save changes
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </PageContainer>
    );
}
