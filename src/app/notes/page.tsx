import { BookOpen, MessageSquare, Plus, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import Link from "next/link";
import {
    NOTE_THREAD_CATEGORIES,
    getNoteThreadCategoryLabel,
    normalizeNoteThreadCategory,
} from "@/lib/note-categories";

type NotesPageProps = {
    searchParams: Promise<{ category?: string }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
    const session = await auth();
    const params = await searchParams;
    const activeCategory = params?.category
        ? normalizeNoteThreadCategory(params.category)
        : null;

    const threads = await db.note.findMany({
        where: {
            issueId: null,
            isThread: true,
            parentId: null,
        },
        include: {
            author: true,
            _count: { select: { replies: true } },
            replies: {
                select: { createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 1,
            },
        },
        orderBy: { updatedAt: "desc" },
    });
    const folderCounts = threads.reduce<Record<string, number>>((acc, thread) => {
        const key = normalizeNoteThreadCategory(thread.category);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const filteredThreads = activeCategory
        ? threads.filter((thread) => normalizeNoteThreadCategory(thread.category) === activeCategory)
        : threads;

    const groupedThreads = NOTE_THREAD_CATEGORIES.map((category) => ({
        ...category,
        threads: filteredThreads.filter(
            (thread) => normalizeNoteThreadCategory(thread.category) === category.id
        ),
    })).filter((group) => group.threads.length > 0);

    return (
        <div className="gta-page max-w-[1200px]">
            <div className="gta-hero flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 text-primary rounded-lg border border-primary/30">
                        <BookOpen className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="gta-heading text-3xl">Crew Notes</h1>
                        <p className="gta-subheading mt-1">
                            Shared documentation and team discussions.
                        </p>
                    </div>
                </div>

                <Link
                    href="/notes/new"
                    className="gta-action"
                >
                    <Plus className="h-4 w-4" />
                    New Thread
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    {filteredThreads.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-10">
                            {activeCategory
                                ? "No threads in this folder yet."
                                : "No threads yet. Create the first thread to start the team forum."}
                        </div>
                    ) : (
                        groupedThreads.map((group) => (
                            <section key={group.id} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-display text-xl uppercase tracking-[0.14em]">
                                        {group.label}
                                    </h2>
                                    <span className="text-xs text-muted-foreground">
                                        {group.threads.length} thread{group.threads.length === 1 ? "" : "s"}
                                    </span>
                                </div>
                                {group.threads.map((thread) => (
                                    <Link
                                        key={thread.id}
                                        href={`/notes/${thread.id}`}
                                        className="block gta-surface p-5 space-y-4 hover:border-primary/40 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            {thread.author.image ? (
                                                <img src={thread.author.image} className="w-10 h-10 rounded-full border" alt="Avatar" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full border bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {thread.author.name?.charAt(0).toUpperCase() || "A"}
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{thread.author.name}</span>
                                                        <span className="text-xs text-muted-foreground" title={thread.createdAt.toISOString()}>
                                                            {new Intl.DateTimeFormat("en-US", {
                                                                dateStyle: "medium",
                                                                timeStyle: "short",
                                                            }).format(thread.createdAt)}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-[0.12em] border border-border px-2 py-0.5 rounded text-muted-foreground">
                                                        {getNoteThreadCategoryLabel(thread.category)}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-lg leading-tight tracking-tight text-foreground">
                                                    {thread.title}
                                                </h3>
                                                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                                    {thread.content}
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-3 border-t">
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                        {thread._count?.replies ?? 0} replies
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Clock3 className="h-3.5 w-3.5" />
                                                        Last activity{" "}
                                                        {new Intl.DateTimeFormat("en-US", {
                                                            dateStyle: "medium",
                                                            timeStyle: "short",
                                                        }).format(thread.replies?.[0]?.createdAt ?? thread.updatedAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </section>
                        ))
                    )}
                </div>

                <div className="space-y-4">
                    <div className="gta-surface p-5">
                        <h3 className="font-display text-xl mb-3 uppercase tracking-[0.18em]">Folders</h3>
                        <div className="space-y-2 mb-5">
                            <Link
                                href="/notes"
                                className={`flex items-center justify-between rounded border px-2.5 py-2 text-xs uppercase tracking-[0.1em] transition-colors ${activeCategory === null
                                    ? "border-primary/45 bg-primary/15 text-foreground"
                                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    }`}
                            >
                                <span>All</span>
                                <span>{threads.length}</span>
                            </Link>
                            {NOTE_THREAD_CATEGORIES.map((category) => (
                                <Link
                                    key={category.id}
                                    href={`/notes?category=${category.id}`}
                                    className={`flex items-center justify-between rounded border px-2.5 py-2 text-xs uppercase tracking-[0.1em] transition-colors ${activeCategory === category.id
                                        ? "border-primary/45 bg-primary/15 text-foreground"
                                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        }`}
                                >
                                    <span>{category.label}</span>
                                    <span>{folderCounts[category.id] || 0}</span>
                                </Link>
                            ))}
                        </div>

                        <h3 className="font-display text-xl mb-3 uppercase tracking-[0.18em]">Forum Guide</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Use folders to organize threads by topic. Pick a folder when creating
                            a thread so your team can find discussions faster.
                        </p>
                        {!session?.user?.id && (
                            <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-3">
                                Sign in to create threads and replies.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
