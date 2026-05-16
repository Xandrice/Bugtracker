"use client";

import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createTeamNote } from "@/app/actions";
import { MentionTextarea } from "@/components/ui/MentionTextarea";
import { NOTE_THREAD_CATEGORIES } from "@/lib/note-categories";
import { PageContainer } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldRow, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {pending ? "Creating…" : "Create thread"}
        </Button>
    );
}

export default function NewNotePage() {
    const [category, setCategory] = useState<string>("GENERAL");

    return (
        <PageContainer className="max-w-3xl">
            <Link
                href="/notes"
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to threads
            </Link>

            <form action={createTeamNote}>
                <Card>
                    <CardHeader>
                        <div className="space-y-1">
                            <CardTitle>Create thread</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Open a forum thread for team documentation or discussion.
                            </p>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <FieldRow label="Thread title" htmlFor="title">
                            <Input
                                id="title"
                                name="title"
                                placeholder="E.g. Incident postmortem: inventory sync outage"
                                required
                            />
                        </FieldRow>

                        <FieldRow label="Folder">
                            <input type="hidden" name="category" value={category} />
                            <Select
                                value={category}
                                onChange={setCategory}
                                size="md"
                                options={NOTE_THREAD_CATEGORIES.map((c) => ({
                                    value: c.id,
                                    label: c.label,
                                }))}
                            />
                        </FieldRow>

                        <FieldRow label="Content" htmlFor="content">
                            <MentionTextarea
                                id="content"
                                name="content"
                                className="block w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus-ring resize-y min-h-[220px]"
                                placeholder="Write the opening post for this thread…"
                                required
                            />
                        </FieldRow>
                    </CardBody>
                    <CardFooter>
                        <Link
                            href="/notes"
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
