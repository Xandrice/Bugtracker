"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem, Button, buttonVariants, cn } from "@heroui/react";
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

    const currentLabel = options.find((o) => o.value === value)?.label || "Unassigned";

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
            <Dropdown>
                <DropdownTrigger
                    className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "w-full justify-between text-xs h-8 border-default-200 hover:border-default-450 bg-background/50 font-semibold cursor-pointer focus:outline-none"
                    )}
                >
                    {currentLabel}
                </DropdownTrigger>
                <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg">
                    <DropdownMenu
                        aria-label="Assignee Select"
                        selectionMode="single"
                        selectedKeys={new Set([value])}
                        onSelectionChange={(keys) => setValue(Array.from(keys)[0] as string)}
                    >
                        {options.map((opt) => (
                            <DropdownItem key={opt.value}>
                                {opt.label}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </DropdownPopover>
            </Dropdown>
            <Button 
                type="submit" 
                variant="primary" 
                size="sm"
                className="w-full h-8 text-xs font-semibold flex items-center justify-center gap-1.5"
                isDisabled={submitting}
            >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Update assignee
            </Button>
        </form>
    );
}
