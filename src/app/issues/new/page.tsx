"use client";

import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { createIssue } from "@/app/actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 disabled:opacity-50"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? "Creating..." : "Create Issue"}
        </button>
    );
}

export default function NewIssuePage() {
    return (
        <div className="flex flex-col h-full p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <Link href="/issues" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to issues
                </Link>
                <h1 className="text-3xl font-bold tracking-tight mt-2">Create New Issue</h1>
                <p className="text-muted-foreground">Fill in the details below to report a new problem or feature request.</p>
            </div>

            <form action={createIssue} className="space-y-6 bg-background p-6 lg:p-8 rounded-xl border shadow-sm">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium leading-none">
                        Title
                    </label>
                    <input
                        id="title"
                        name="title"
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        placeholder="E.g. Cannot login with Discord on Safari"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="type" className="text-sm font-medium leading-none">
                            Issue Type
                        </label>
                        <select
                            id="type"
                            name="type"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="BUG" className="bg-background text-foreground">Bug</option>
                            <option value="FEATURE" className="bg-background text-foreground">Feature Request</option>
                            <option value="TASK" className="bg-background text-foreground">Task</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="priority" className="text-sm font-medium leading-none">
                            Priority
                        </label>
                        <select
                            id="priority"
                            name="priority"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="LOW" className="bg-background text-foreground">Low</option>
                            <option value="MEDIUM" className="bg-background text-foreground">Medium</option>
                            <option value="HIGH" className="bg-background text-foreground">High</option>
                            <option value="URGENT" className="bg-background text-foreground">Urgent</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="severity" className="text-sm font-medium leading-none">
                            Severity
                        </label>
                        <select
                            id="severity"
                            name="severity"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="MINOR" className="bg-background text-foreground">Minor</option>
                            <option value="MAJOR" className="bg-background text-foreground">Major</option>
                            <option value="CRITICAL" className="bg-background text-foreground">Critical</option>
                            <option value="BLOCKER" className="bg-background text-foreground">Blocker</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="environment" className="text-sm font-medium leading-none">
                            Environment
                        </label>
                        <input
                            id="environment"
                            name="environment"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="E.g. iOS Safari 17.0, Chrome 120"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="tags" className="text-sm font-medium leading-none">
                            Tags
                        </label>
                        <input
                            id="tags"
                            name="tags"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="login, ui, authentication..."
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium leading-none">
                        Description
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        className="flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
                        placeholder="Provide clear steps to reproduce or details about the feature request..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Link href="/issues" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted h-10 px-4 py-2 border text-muted-foreground">
                        Cancel
                    </Link>
                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}
