"use client";

import { ArrowLeft, Save, Loader2, Calendar, Target } from "lucide-react";
import Link from "next/link";
import { createIssue } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { useState } from "react";

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
    const [severity, setSeverity] = useState("MINOR");
    const severityImpactCopy: Record<string, string> = {
        MINOR: "Affects a few players (1-5) with a workaround available.",
        MAJOR: "Affects multiple players (6-20) and disrupts normal play.",
        CRITICAL: "Affects many players (21+) and blocks core gameplay loops.",
        BLOCKER: "Affects nearly everyone and prevents the server or feature from being used.",
    };

    return (
        <div className="gta-page max-w-3xl">
            <div className="gta-hero flex flex-col gap-2">
                <Link
                    href="/issues"
                    className="relative z-10 inline-flex items-center gap-1.5 w-fit rounded-sm border border-border/70 bg-muted/45 px-2.5 py-1.5 leading-none text-[11px] font-semibold uppercase tracking-[0.08em] text-white/95 hover:text-white hover:border-primary/50 transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    Back to issues
                </Link>
                <h1 className="gta-heading mt-2">
                    New Dispatch Ticket
                </h1>
                <p className="gta-subheading">
                    Submit a bug, feature request, or task for your FiveM server. Include resource name and steps to reproduce when relevant.
                </p>
            </div>

            <form action={createIssue} className="space-y-6 gta-surface p-6 lg:p-8">
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
                            <option value="URGENT">P0 (Immediate Attention)</option>
                            <option value="HIGH">P1 (High Impact)</option>
                            <option value="MEDIUM">P2 (Standard Impact)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="severity" className="text-sm font-medium leading-none">Severity</label>
                        <select
                            id="severity"
                            name="severity"
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="MINOR">Minor (1-5 affected)</option>
                            <option value="MAJOR">Major (6-20 affected)</option>
                            <option value="CRITICAL">Critical (21+ affected)</option>
                            <option value="BLOCKER">Blocker (Most/All affected)</option>
                        </select>
                        <p className="text-xs text-muted-foreground">{severityImpactCopy[severity]}</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label htmlFor="tags" className="text-sm font-medium leading-none">Tags</label>
                        <input
                            id="tags"
                            name="tags"
                            className="flex h-10 w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="resource:police-mdt, ui, lua..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="label" className="text-sm font-medium leading-none">Label / category</label>
                        <select
                            id="label"
                            name="label"
                            className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <option value="">Select category</option>
                            <option value="SCRIPT">Script</option>
                            <option value="MAP">Map</option>
                            <option value="CAR">Car</option>
                            <option value="CLOTHES">Clothes</option>
                            <option value="OTHER">Other / Misc</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
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
