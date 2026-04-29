"use client";

import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { createTeamNote } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { MentionTextarea } from "@/components/ui/MentionTextarea";
import { NOTE_THREAD_CATEGORIES } from "@/lib/note-categories";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 disabled:opacity-50"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? "Creating..." : "Create Thread"}
        </button>
    );
}

export default function NewNotePage() {
    return (
        <div className="gta-page max-w-3xl">
            <div className="gta-hero flex flex-col gap-2">
                <Link
                    href="/notes"
                    className="relative z-10 inline-flex items-center gap-1.5 w-fit rounded-sm border border-border/70 bg-muted/45 px-2.5 py-1.5 leading-none text-[11px] font-semibold uppercase tracking-[0.08em] text-white/95 hover:text-white hover:border-primary/50 transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    Back to threads
                </Link>
                <h1 className="gta-heading mt-2">Create Thread</h1>
                <p className="gta-subheading">Open a forum thread for team documentation or discussion.</p>
            </div>

            <form action={createTeamNote} className="space-y-6 gta-surface p-6 lg:p-8">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium leading-none">
                        Thread Title
                    </label>
                    <input
                        id="title"
                        name="title"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        placeholder="E.g. Incident postmortem: inventory sync outage"
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
                        defaultValue="GENERAL"
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
                    <MentionTextarea
                        id="content"
                        name="content"
                        className="flex min-h-[250px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
                        placeholder="Write the opening post for this thread..."
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Link href="/notes" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted h-10 px-4 py-2 border text-muted-foreground">
                        Cancel
                    </Link>
                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}
