"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteIssue } from "@/app/actions";
import { Button } from "@heroui/react";

export default function DeleteIssueForm({ issueId }: { issueId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);

    return (
        <form
            action={async (formData) => {
                const confirmed = window.confirm(
                    "Delete this issue permanently? This cannot be undone."
                );
                if (!confirmed) return;
                setIsDeleting(true);
                await deleteIssue(formData);
            }}
            className="flex flex-col gap-2"
        >
            <input type="hidden" name="issueId" value={issueId} />
            <p className="text-xs text-muted-foreground">
                Permanently delete this issue, its subtasks, and notes.
            </p>
            <Button 
                type="submit" 
                variant="danger" 
                size="sm" 
                className="font-semibold" 
                isDisabled={isDeleting}
            >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isDeleting ? "Deleting…" : "Delete issue"}
            </Button>
        </form>
    );
}
