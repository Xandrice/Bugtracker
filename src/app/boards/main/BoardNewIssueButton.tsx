"use client";

import { Plus } from "lucide-react";
import { QuickCreateTrigger } from "@/components/issues/QuickCreateIssue";

export function BoardNewIssueButton() {
    return (
        <QuickCreateTrigger className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />
            New issue
        </QuickCreateTrigger>
    );
}
