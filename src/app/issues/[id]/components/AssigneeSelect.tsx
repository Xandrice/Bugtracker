"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { setAssignee } from "@/app/actions";

export function AssigneeSelect({
    issueId,
    defaultValue,
    users,
}: {
    issueId: string;
    defaultValue: string;
    users: { id: string; name: string | null }[];
}) {
    const [value, setValue] = useState(defaultValue);
    const [submitting, setSubmitting] = useState(false);

    const options = [
        { value: "none", label: "Unassigned" },
        ...users.map((u) => ({ value: u.id, label: u.name || u.id })),
    ];

    return (
        <form
            action={async (formData) => {
                setSubmitting(true);
                try {
                    await setAssignee(formData);
                } finally {
                    setSubmitting(false);
                }
            }}
            className="space-y-2"
        >
            <input type="hidden" name="issueId" value={issueId} />
            <input type="hidden" name="assigneeId" value={value} />
            <Select
                value={value}
                onChange={setValue}
                options={options}
                size="xs"
                maxVisibleItems={3}
            />
            <Button type="submit" variant="primary" size="xs" disabled={submitting}>
                {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Update assignee
            </Button>
        </form>
    );
}
