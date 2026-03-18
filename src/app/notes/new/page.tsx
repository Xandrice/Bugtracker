"use client";

import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { createTeamNote } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { MentionTextarea } from "@/components/ui/MentionTextarea";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 disabled:opacity-50"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? "Creating..." : "Create Note"}
        </button>
    );
}

export default function NewNotePage() {
    return (
        <div className="flex flex-col h-full p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <Link href="/notes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to notes
                </Link>
                <h1 className="text-3xl font-bold tracking-tight mt-2">Create New Note</h1>
                <p className="text-muted-foreground">Share documentation or start a new team discussion.</p>
            </div>

            <form action={createTeamNote} className="space-y-6 bg-background p-6 lg:p-8 rounded-xl border shadow-sm">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium leading-none">
                        Note Title
                    </label>
                    <input
                        id="title"
                        name="title"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        placeholder="E.g. Architecture decision for v2.0"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="content" className="text-sm font-medium leading-none">
                        Content
                    </label>
                    <MentionTextarea
                        id="content"
                        name="content"
                        className="flex min-h-[250px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
                        placeholder="Write down the details, decisions, or guidelines here..."
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
