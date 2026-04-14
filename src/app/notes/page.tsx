import { BookOpen, MessageSquare, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import Link from "next/link";

export default async function NotesPage() {
    const session = await auth();
    const notesRaw = await db.note.findMany({
        where: { issueId: null } as any,
        include: { author: true } as any,
        orderBy: { createdAt: "desc" }
    });
    const notes: any[] = notesRaw;

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
                    New Note
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    {notes.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-10">
                            No team notes found. Create a new note to start the discussion!
                        </div>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className="gta-surface p-5 space-y-4">
                                <div className="flex items-start gap-4">
                                    {note.author.image ? (
                                        <img src={note.author.image} className="w-10 h-10 rounded-full border" alt="Avatar" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full border bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {note.author.name?.charAt(0).toUpperCase() || "A"}
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm">{note.author.name}</span>
                                                <span className="text-xs text-muted-foreground" title={note.createdAt.toISOString()}>
                                                    {new Intl.DateTimeFormat("en-US", {
                                                        dateStyle: "medium",
                                                        timeStyle: "short",
                                                    }).format(note.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        {note.title && (
                                            <h3 className="font-bold text-lg leading-tight tracking-tight text-foreground">
                                                {note.title}
                                            </h3>
                                        )}
                                        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                            {note.content}
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 pt-3 border-t">
                                            <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                                                <MessageSquare className="h-3.5 w-3.5" /> Comments
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-4">
                    <div className="gta-surface p-5">
                        <h3 className="font-display text-xl mb-4 uppercase tracking-[0.18em]">Pinned Notes</h3>
                        <ul className="space-y-3">
                            <li>
                                <a href="#" className="text-sm text-primary hover:underline line-clamp-2">Architecture decision for v2.0 - Migration to App Router</a>
                                <span className="text-xs text-muted-foreground mt-1 block">Jan 12, 2026</span>
                            </li>
                            <li>
                                <a href="#" className="text-sm text-primary hover:underline line-clamp-2">Discord Dev Portal Configuration Guide</a>
                                <span className="text-xs text-muted-foreground mt-1 block">Jan 5, 2026</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
