"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownMenu,
    DropdownItem,
    Button,
    buttonVariants,
    cn,
} from "@heroui/react";
import { saveIssueWorkflow } from "@/app/actions";
import {
    PRIORITY_OPTIONS,
    PRIORITY_META,
    SEVERITY_OPTIONS,
    SEVERITY_META,
    STATUS_OPTIONS,
    STATUS_META,
    TYPE_OPTIONS,
    TYPE_META,
    type IssuePriority,
    type IssueSeverity,
    type IssueStatus,
    type IssueType,
} from "@/lib/issue-tokens";

export function WorkflowFields({
    issueId,
    defaultType,
    defaultPriority,
    defaultSeverity,
    defaultStatus,
}: {
    issueId: string;
    defaultType: IssueType;
    defaultPriority: IssuePriority;
    defaultSeverity: IssueSeverity;
    defaultStatus: IssueStatus;
}) {
    const [type, setType] = useState<string>(defaultType);
    const [priority, setPriority] = useState<string>(defaultPriority);
    const [severity, setSeverity] = useState<string>(defaultSeverity);
    const [status, setStatus] = useState<string>(defaultStatus);
    const [submitting, setSubmitting] = useState(false);

    return (
        <form
            action={async (formData) => {
                setSubmitting(true);
                try {
                    await saveIssueWorkflow(formData);
                } finally {
                    setSubmitting(false);
                }
            }}
            className="space-y-3"
        >
            <input type="hidden" name="issueId" value={issueId} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="priority" value={priority} />
            <input type="hidden" name="severity" value={severity} />
            <input type="hidden" name="status" value={status} />

            <div className="grid grid-cols-2 gap-2">
                {/* Type */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-default-450">Type</span>
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full h-8 justify-between px-2.5 text-xs border-default-200 hover:border-default-455 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                            )}
                        >
                            <span className="flex items-center gap-1.5 truncate">
                                {TYPE_META[type as IssueType]?.icon}
                                {TYPE_META[type as IssueType]?.label}
                            </span>
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu
                                aria-label="Select Type"
                                selectionMode="single"
                                selectedKeys={new Set([type])}
                                onSelectionChange={(keys) => setType(Array.from(keys)[0] as string)}
                            >
                                {TYPE_OPTIONS.map((opt) => (
                                    <DropdownItem key={opt.value}>
                                        <span className="flex items-center gap-2">
                                            {opt.icon}
                                            {opt.label}
                                        </span>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-default-455">Priority</span>
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full h-8 justify-between px-2.5 text-xs border-default-200 hover:border-default-455 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                            )}
                        >
                            <span className="flex items-center gap-1.5 truncate">
                                {PRIORITY_META[priority as IssuePriority]?.icon}
                                {PRIORITY_META[priority as IssuePriority]?.label}
                            </span>
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu
                                aria-label="Select Priority"
                                selectionMode="single"
                                selectedKeys={new Set([priority])}
                                onSelectionChange={(keys) => setPriority(Array.from(keys)[0] as string)}
                            >
                                {PRIORITY_OPTIONS.map((opt) => (
                                    <DropdownItem key={opt.value}>
                                        <span className="flex items-center gap-2">
                                            {opt.icon}
                                            {opt.label}
                                        </span>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>
                </div>

                {/* Severity */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-default-455">Severity</span>
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full h-8 justify-between px-2.5 text-xs border-default-200 hover:border-default-455 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                            )}
                        >
                            <span className="truncate">
                                {SEVERITY_META[severity as IssueSeverity]?.label}
                            </span>
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu
                                aria-label="Select Severity"
                                selectionMode="single"
                                selectedKeys={new Set([severity])}
                                onSelectionChange={(keys) => setSeverity(Array.from(keys)[0] as string)}
                            >
                                {SEVERITY_OPTIONS.map((opt) => (
                                    <DropdownItem key={opt.value}>
                                        {opt.label}
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-default-455">Status</span>
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full h-8 justify-between px-2.5 text-xs border-default-200 hover:border-default-455 bg-background/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                            )}
                        >
                            <span className="flex items-center gap-1.5 truncate">
                                {STATUS_META[status as IssueStatus]?.icon}
                                {STATUS_META[status as IssueStatus]?.label}
                            </span>
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu
                                aria-label="Select Status"
                                selectionMode="single"
                                selectedKeys={new Set([status])}
                                onSelectionChange={(keys) => setStatus(Array.from(keys)[0] as string)}
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <DropdownItem key={opt.value}>
                                        <span className="flex items-center gap-2">
                                            {opt.icon}
                                            {opt.label}
                                        </span>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>
                </div>
            </div>

            <Button 
                type="submit" 
                variant="primary" 
                size="sm" 
                className="w-full h-8 font-semibold flex items-center justify-center gap-1.5"
                isDisabled={submitting}
            >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save workflow
            </Button>
        </form>
    );
}
