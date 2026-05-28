"use client";

import { ArrowLeft, Save, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import { createIssue } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { PageContainer } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
    PRIORITY_OPTIONS,
    SEVERITY_OPTIONS,
    TYPE_OPTIONS,
} from "@/lib/issue-tokens";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {pending ? "Creating…" : "Create issue"}
        </Button>
    );
}

const LABEL_OPTIONS = [
    { value: "", label: "—" },
    { value: "SCRIPT", label: "Script" },
    { value: "MAP", label: "Map" },
    { value: "CAR", label: "Car" },
    { value: "CLOTHES", label: "Clothes" },
    { value: "OTHER", label: "Other / misc" },
];

const SEVERITY_HINT: Record<string, string> = {
    MINOR: "Affects a few players (1–5) with a workaround available.",
    MAJOR: "Affects multiple players (6–20) and disrupts normal play.",
    CRITICAL: "Affects many players (21+) and blocks core gameplay loops.",
    BLOCKER: "Affects nearly everyone and prevents the server or feature from being used.",
};

export default function NewIssuePage() {
    const [severity, setSeverity] = useState("MINOR");
    const [type, setType] = useState("BUG");
    const [priority, setPriority] = useState("MEDIUM");
    const [label, setLabel] = useState("");

    return (
        <PageContainer className="max-w-3xl">
            <Link
                href="/issues"
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to issues
            </Link>

            <form action={createIssue}>
                <Card>
                    <CardHeader>
                        <div className="space-y-1">
                            <CardTitle>New issue</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Submit a bug, feature request, or task. Include resource name and steps to
                                reproduce when relevant.
                            </p>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-5">
                        <FieldRow label="Title" htmlFor="title">
                            <Input
                                id="title"
                                name="title"
                                placeholder="E.g. Police MDT fails to load when off duty"
                                required
                            />
                        </FieldRow>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <FieldRow label="Type" htmlFor="type">
                                <Select
                                    name="type"
                                    value={type}
                                    onChange={setType}
                                    options={TYPE_OPTIONS}
                                    size="md"
                                />
                            </FieldRow>
                            <FieldRow label="Priority" htmlFor="priority">
                                <Select
                                    name="priority"
                                    value={priority}
                                    onChange={setPriority}
                                    options={PRIORITY_OPTIONS}
                                    size="md"
                                />
                            </FieldRow>
                            <FieldRow label="Severity" htmlFor="severity" hint={SEVERITY_HINT[severity]}>
                                <Select
                                    name="severity"
                                    value={severity}
                                    onChange={setSeverity}
                                    options={SEVERITY_OPTIONS}
                                    size="md"
                                />
                            </FieldRow>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FieldRow label="Tags" htmlFor="tags">
                                <Input
                                    id="tags"
                                    name="tags"
                                    placeholder="resource:police-mdt, ui, lua"
                                />
                            </FieldRow>
                            <FieldRow label="Label / category" htmlFor="label">
                                <Select
                                    name="label"
                                    value={label}
                                    onChange={setLabel}
                                    options={LABEL_OPTIONS}
                                    size="md"
                                />
                            </FieldRow>
                        </div>

                        <FieldRow label="Due date" htmlFor="dueDate">
                            <div className="relative">
                                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle-foreground" />
                                <Input id="dueDate" name="dueDate" type="date" className="pl-8" />
                            </div>
                        </FieldRow>

                        <FieldRow
                            label="Discord forum post (optional)"
                            htmlFor="discordPostId"
                            hint="Paste a Discord post link or post ID — the bot will add a tracker notice."
                        >
                            <Input
                                id="discordPostId"
                                name="discordPostId"
                                className="font-mono"
                                placeholder="https://discord.com/channels/.../1489040926197289083"
                            />
                        </FieldRow>

                        <FieldRow label="Description" htmlFor="description">
                            <Textarea
                                id="description"
                                name="description"
                                rows={5}
                                placeholder="What happened or what do you want? Be specific."
                            />
                        </FieldRow>

                        <FieldRow label="Steps to reproduce (bugs)" htmlFor="reproductionSteps">
                            <Textarea
                                id="reproductionSteps"
                                name="reproductionSteps"
                                rows={4}
                                placeholder="1. Go to… 2. Click… 3. See error"
                            />
                        </FieldRow>
                    </CardBody>
                    <CardFooter>
                        <Link
                            href="/issues"
                            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 h-9 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            Cancel
                        </Link>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </PageContainer>
    );
}
