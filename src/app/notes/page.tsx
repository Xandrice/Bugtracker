import { BookOpen, MessageSquare, Plus, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import Link from "next/link";
import {
    NOTE_THREAD_CATEGORIES,
    getNoteThreadCategoryLabel,
    normalizeNoteThreadCategory,
} from "@/lib/note-categories";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/Section";
import { cn } from "@/components/ui/cn";
import { MarkdownContent } from "@/components/ui/MarkdownContent";

type NotesPageProps = {
    searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
    const session = await auth();
    const params = await searchParams;
    const searchQuery = params?.q?.trim() || "";
    const activeCategory = params?.category
        ? normalizeNoteThreadCategory(params.category)
        : null;

    const threads = await db.note.findMany({
        where: {
            issueId: null,
            isThread: true,
            parentId: null,
            ...(searchQuery
                ? {
                      OR: [
                          { title: { contains: searchQuery, mode: "insensitive" } },
                          { content: { contains: searchQuery, mode: "insensitive" } },
                      ],
                  }
                : {}),
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
        ? threads.filter((t) => normalizeNoteThreadCategory(t.category) === activeCategory)
        : threads;

    const groupedThreads = NOTE_THREAD_CATEGORIES.map((category) => ({
        ...category,
        threads: filteredThreads.filter(
            (thread) => normalizeNoteThreadCategory(thread.category) === category.id
        ),
    })).filter((group) => group.threads.length > 0);

    return (
        <PageContainer>
            <PageHeader
                title="Playbooks"
                description="Shared documentation, SOPs, and team discussions."
                icon={<BookOpen className="h-4 w-4" />}
                actions={
                    <Link
                        href="/notes/new"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New thread
                    </Link>
                }
            />

            <form method="get" className="relative max-w-md">
                <input
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search playbooks…"
                    className="h-8 w-full rounded-md border border-input bg-elevated px-3 text-xs focus-ring"
                />
            </form>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5">
                <div className="space-y-5 min-w-0">
                    {filteredThreads.length === 0 ? (
                        <EmptyState
                            icon={<BookOpen className="h-5 w-5" />}
                            title={activeCategory ? "No threads in this folder yet" : "No threads yet"}
                            description={
                                activeCategory
                                    ? "Switch folders or start a new thread to get going."
                                    : "Create the first thread to start the team forum."
                            }
                        />
                    ) : (
                        groupedThreads.map((group) => (
                            <section key={group.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-semibold text-foreground">
                                        {group.label}
                                    </h2>
                                    <span className="text-[11px] text-muted-foreground">
                                        {group.threads.length} thread
                                        {group.threads.length === 1 ? "" : "s"}
                                    </span>
                                </div>
                                <div className="overflow-hidden rounded-md border border-border bg-surface divide-y divide-border">
                                    {group.threads.map((thread) => (
                                        <Link
                                            key={thread.id}
                                            href={`/notes/${thread.id}`}
                                            className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/40"
                                        >
                                            <Avatar
                                                src={thread.author.image}
                                                name={thread.author.name}
                                                size="md"
                                            />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <h3 className="text-sm font-semibold text-foreground truncate">
                                                        {thread.title}
                                                    </h3>
                                                    <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                                        {getNoteThreadCategoryLabel(thread.category)}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground line-clamp-2">
                                                    <MarkdownContent content={thread.content} />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-subtle-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <span className="text-foreground/80">
                                                            {thread.author.name || "Unknown"}
                                                        </span>
                                                        ·{" "}
                                                        {new Intl.DateTimeFormat("en-US", {
                                                            dateStyle: "medium",
                                                        }).format(thread.createdAt)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="h-3 w-3" />
                                                        {thread._count?.replies ?? 0}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock3 className="h-3 w-3" />
                                                        Last activity{" "}
                                                        {new Intl.DateTimeFormat("en-US", {
                                                            dateStyle: "medium",
                                                        }).format(
                                                            thread.replies?.[0]?.createdAt ??
                                                                thread.updatedAt
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))
                    )}
                </div>

                <div className="space-y-3">
                    <div className="rounded-md border border-border bg-surface p-3">
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Folders
                        </h3>
                        <div className="space-y-0.5">
                            <Link
                                href="/notes"
                                className={cn(
                                    "flex items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors",
                                    activeCategory === null
                                        ? "bg-primary/12 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <span>All</span>
                                <span>{threads.length}</span>
                            </Link>
                            {NOTE_THREAD_CATEGORIES.map((category) => (
                                <Link
                                    key={category.id}
                                    href={`/notes?category=${category.id}`}
                                    className={cn(
                                        "flex items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors",
                                        activeCategory === category.id
                                            ? "bg-primary/12 text-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <span>{category.label}</span>
                                    <span>{folderCounts[category.id] || 0}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground space-y-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Forum guide
                        </h3>
                        <p>
                            Use folders to organize threads by topic. Pick a folder when creating a
                            thread so your team can find discussions faster.
                        </p>
                        {!session?.user?.id && (
                            <p className="border-t border-border pt-2">
                                Sign in to create threads and replies.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
