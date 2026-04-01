"use client";

import { useState } from "react";
import { deleteIssue } from "@/app/actions";

export default function DeleteIssueForm({ issueId }: { issueId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);

    return (
        <form
            action={async (formData) => {
                const confirmed = window.confirm("Delete this issue permanently? This cannot be undone.");
                if (!confirmed) return;
                setIsDeleting(true);
                await deleteIssue(formData);
            }}
            className="flex flex-col gap-2"
        >
            <input type="hidden" name="issueId" value={issueId} />
            <p className="text-xs text-muted-foreground">Permanently delete this bug/feature and its notes.</p>
            <button
                type="submit"
                disabled={isDeleting}
                className="text-xs rounded-md px-2.5 py-1.5 border transition-colors border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300 disabled:opacity-60"
            >
                {isDeleting ? "Deleting..." : "Delete Issue"}
            </button>
        </form>
    );
}
