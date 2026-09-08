import { BookOpen, MessageSquare, Plus, Clock3, Search, Folder, Files, ChevronRight, FileText } from "lucide-react";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./NotesSearch.module.css";

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

    const folderHref = (category: string | null) => {
        const query = new URLSearchParams();
        if (category) query.set("category", category);
        if (searchQuery) query.set("q", searchQuery);
        return query.size ? `/notes?${query}` : "/notes";
    };
    const formatDate = (date: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);

    return (
        <PageContainer>
            <PageHeader
                title="Playbooks"
                description="Your team's guides, procedures, and shared knowledge."
                icon={<BookOpen className="h-4 w-4" />}
                actions={
                    <Link href="/notes/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-ring">
                        <Plus className="h-4 w-4" /> New thread
                    </Link>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                <aside className="space-y-5 lg:sticky lg:top-6">
                    <nav aria-label="Playbook folders" className="rounded-lg border border-border bg-surface p-3">
                        <h2 className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Library</h2>
                        <div className="flex flex-wrap gap-1 lg:flex-col">
                            {[{ id: null, label: "All playbooks", count: threads.length }, ...NOTE_THREAD_CATEGORIES.map((category) => ({ ...category, count: folderCounts[category.id] || 0 }))].map((category) => {
                                const selected = activeCategory === category.id;
                                const Icon = category.id ? Folder : Files;
                                return <Link key={category.id || "all"} href={folderHref(category.id)} aria-current={selected ? "page" : undefined}
                                    className={cn("flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors focus-ring", selected ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="flex-1">{category.label}</span>
                                    <span className={cn("ml-3 rounded px-1.5 text-[10px] tabular-nums", selected ? "bg-primary/10" : "bg-muted")}>{category.count}</span>
                                </Link>;
                            })}
                        </div>
                    </nav>
                    <div className="hidden px-3 text-xs leading-relaxed text-muted-foreground lg:block">
                        <p className="mb-1 font-medium text-foreground">A place for team knowledge</p>
                        <p>Browse a folder to find a guide, or start a thread to share a process with the team.</p>
                        {!session?.user?.id && <p className="mt-3">Sign in to create threads and replies.</p>}
                    </div>
                </aside>

                <div className="min-w-0 space-y-5">
                    <form method="get" className={styles.searchForm} role="search">
                        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
                        <div className={styles.searchField}>
                            <Search aria-hidden="true" className={styles.searchIcon} />
                            <input id="playbook-search" name="q" type="search" aria-label="Search playbooks" defaultValue={searchQuery} placeholder="Search titles and content..."
                                className={styles.searchInput} />
                        </div>
                        <button type="submit" className={styles.searchButton}>Search</button>
                    </form>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-base font-semibold text-foreground">{activeCategory ? getNoteThreadCategoryLabel(activeCategory) : "All playbooks"}</h2>
                            <span className="text-xs text-muted-foreground">{filteredThreads.length} {filteredThreads.length === 1 ? "thread" : "threads"}</span>
                        </div>
                        {searchQuery ? <Link href={activeCategory ? `/notes?category=${activeCategory}` : "/notes"} className="text-xs text-primary hover:underline focus-ring">Clear search</Link> :
                            <span className="text-xs text-subtle-foreground">Recently updated in each folder</span>}
                    </div>

                    {filteredThreads.length === 0 ? (
                        <EmptyState icon={<BookOpen className="h-5 w-5" />}
                            title={searchQuery ? "No matching playbooks" : activeCategory ? "This folder is empty" : "Your library starts here"}
                            description={searchQuery ? "Try a different search or browse another folder." : "Create a thread to share a guide, procedure, or discussion with your team."} />
                    ) : (
                        <div className="space-y-6">
                            {groupedThreads.map((group) => (
                                <section key={group.id} aria-label={group.label} className="space-y-2">
                                    {!activeCategory && <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                                        <Folder className="h-3.5 w-3.5" /><h3 className="font-medium">{group.label}</h3>
                                        <span className="text-subtle-foreground">{group.threads.length}</span>
                                    </div>}
                                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                                        {group.threads.map((thread) => {
                                            const lastActivity = new Date(Math.max(thread.updatedAt.getTime(), thread.replies[0]?.createdAt.getTime() || 0));
                                            const replies = thread._count.replies;
                                            return <Link key={thread.id} href={`/notes/${thread.id}`} className="group block p-4 transition-colors hover:bg-muted/40 focus-ring sm:p-5">
                                                <div className="flex items-start gap-3 sm:gap-4">
                                                    <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground transition-colors group-hover:text-primary sm:flex">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h4 className="line-clamp-2 break-words text-sm font-semibold leading-6 text-foreground transition-colors group-hover:text-primary">{thread.title || "Untitled playbook"}</h4>
                                                            <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                                        </div>
                                                        <div className="mt-1 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={[]} unwrapDisallowed skipHtml>{thread.content}</ReactMarkdown>
                                                        </div>
                                                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-subtle-foreground">
                                                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                                                <Avatar src={thread.author.image} name={thread.author.name} size="xs" />
                                                                <span className="max-w-40 truncate text-muted-foreground">{thread.author.name || "Unknown"}</span>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5" title={`Created ${formatDate(thread.createdAt)}`}>
                                                                <Clock3 className="h-3 w-3" /> Updated {formatDate(lastActivity)}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <MessageSquare className="h-3 w-3" />{replies} {replies === 1 ? "reply" : "replies"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>;
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
