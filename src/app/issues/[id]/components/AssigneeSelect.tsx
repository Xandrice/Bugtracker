"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AssigneePicker } from "@/components/issues/AssigneePicker";
import { updateIssueAssignees } from "@/app/actions";
import type { IssueAssigneeUser } from "@/lib/issue-assignees";

export function AssigneeSelect({
    issueId,
    defaultValues,
    users,
}: {
    issueId: string;
    defaultValues: string[];
    users: IssueAssigneeUser[];
}) {
    const router = useRouter();
    const [value, setValue] = useState(defaultValues);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");

    return (
        <form
            onSubmit={event => {
                event.preventDefault();
                setError("");
                startTransition(async () => {
                    try {
                        const result = await updateIssueAssignees(issueId, value);
                        if (result.error) setError(result.error);
                        else router.refresh();
                    } catch {
                        setError("Could not save assignees. Please try again.");
                    }
                });
            }}
            className="space-y-2"
        >
            <AssigneePicker users={users} value={value} onChange={setValue} disabled={pending} />
            <Button type="submit" variant="primary" size="xs" disabled={pending}>
                {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                Update assignees
            </Button>
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </form>
    );
}
