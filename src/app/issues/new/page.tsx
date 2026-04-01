"use client";

import { ArrowLeft, Save, Loader2, Gamepad2, Code, Calendar, Target } from "lucide-react";
import Link from "next/link";
import { createIssue } from "@/app/actions";
import { useFormStatus } from "react-dom";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all bg-primary text-primary-foreground hover:opacity-90 shadow-md hover:shadow-lg h-10 px-5 py-2 gap-2 disabled:opacity-50"
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
                <Link href="/issues" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 w-fit transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to issues
                </Link>
                <h1 className="text-3xl font-bold tracking-tight mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Report Bug or Feature
                </h1>
                <p className="text-muted-foreground">
                    Submit a bug, feature request, or task for your FiveM server. Include resource name and steps to reproduce when relevant.
                </p>
            </div>

            <form action={createIssue} className="space-y-6 bg-background p-6 lg:p-8 rounded-xl border border-border shadow-lg shadow-primary/5">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium leading-none">
                        Title <span className="text-danger">*</span>
                    </label>
                    <input
                        id="title"
                        name="title"
                        className="flex h-10 w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        placeholder="E.g. Police MDT fails to load when off duty"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label htmlFor="type" className="text-sm font-medium leading-none flex items-center gap-1.5">
                            <Target className="h-4 w-4 text-primary" /> Type <span className="text-danger">*</span>
                        </label>
                        <select
                            id="type"
                            name="type"
                            className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="BUG">Bug</option>
                            <option value="FEATURE">Feature Request</option>
                            <option value="TASK">Task</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="priority" className="text-sm font-medium leading-none">Priority <span className="text-danger">*</span></label>
                        <select
                            id="priority"
                            name="priority"
                            className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="severity" className="text-sm font-medium leading-none">Severity</label>
                        <select
                            id="severity"
                            name="severity"
                            className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="MINOR">Minor</option>
                            <option value="MAJOR">Major</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="BLOCKER">Blocker</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="space-y-2">
                        <label htmlFor="resourceName" className="text-sm font-medium leading-none flex items-center gap-1.5">
                            <Code className="h-4 w-4 text-accent" /> Resource name
                        </label>
                        <input
                            id="resourceName"
                            name="resourceName"
                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="e.g. es_extended, police-mdt"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="serverVersion" className="text-sm font-medium leading-none flex items-center gap-1.5">
                            <Gamepad2 className="h-4 w-4 text-accent" /> Server / build
                        </label>
                        <input
                            id="serverVersion"
                            name="serverVersion"
                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="e.g. 6683, artifact"
                        />
                    </div>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-muted/40 border border-border">
                    <label htmlFor="discordPostId" className="text-sm font-medium leading-none">
                        Discord forum post (optional)
                    </label>
                    <input
                        id="discordPostId"
                        name="discordPostId"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="Paste post link or post ID"
                    />
                    <p className="text-xs text-muted-foreground">
                        Example: https://discord.com/channels/1083964697532973157/1489040926197289083 or 1489040926197289083
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label htmlFor="environment" className="text-sm font-medium leading-none">Environment</label>
                        <input
                            id="environment"
                            name="environment"
                            className="flex h-10 w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="E.g. Windows, FXServer 6683"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="tags" className="text-sm font-medium leading-none">Tags</label>
                        <input
                            id="tags"
                            name="tags"
                            className="flex h-10 w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="police, mdt, ui, lua..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="label" className="text-sm font-medium leading-none">Label / category</label>
                        <input
                            id="label"
                            name="label"
                            className="flex h-10 w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="e.g. Scripts, Police, Economy"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label htmlFor="dueDate" className="text-sm font-medium leading-none flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-muted-foreground" /> Due date
                        </label>
                        <input
                            id="dueDate"
                            name="dueDate"
                            type="date"
                            className="flex h-10 w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="storyPoints" className="text-sm font-medium leading-none">Story points</label>
                        <select
                            id="storyPoints"
                            name="storyPoints"
                            className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="">—</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="5">5</option>
                            <option value="8">8</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium leading-none">Description</label>
                    <textarea
                        id="description"
                        name="description"
                        className="flex min-h-[120px] w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
                        placeholder="What happened or what do you want? Be specific."
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="reproductionSteps" className="text-sm font-medium leading-none">Steps to reproduce (bugs)</label>
                    <textarea
                        id="reproductionSteps"
                        name="reproductionSteps"
                        className="flex min-h-[80px] w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
                        placeholder="1. Go to... 2. Click... 3. See error"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="expectedBehavior" className="text-sm font-medium leading-none">Expected behavior</label>
                    <textarea
                        id="expectedBehavior"
                        name="expectedBehavior"
                        className="flex min-h-[80px] w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
                        placeholder="What should happen instead?"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Link href="/issues" className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-muted h-10 px-4 py-2 border text-muted-foreground">
                        Cancel
                    </Link>
                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}
