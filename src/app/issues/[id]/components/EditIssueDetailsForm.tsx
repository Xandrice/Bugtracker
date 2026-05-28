"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveIssueDetails } from "@/app/actions";
import {
    Button,
    Input,
    TextArea,
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownMenu,
    DropdownItem,
    TextField,
    Label,
    buttonVariants,
    cn,
} from "@heroui/react";
import {
    PRIORITY_OPTIONS,
    SEVERITY_OPTIONS,
    PRIORITY_META,
    SEVERITY_META,
    normalizePriority,
    normalizeSeverity,
    type IssuePriority,
    type IssueSeverity,
} from "@/lib/issue-tokens";

type IssueForEdit = {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    severity: string;
    tags: string | null;
    label: string | null;
    dueDate: Date | null;
    storyPoints: number | null;
    resourceName: string | null;
    serverVersion: string | null;
    reproductionSteps: string | null;
    expectedBehavior: string | null;
    environment: string | null;
};

const LABEL_OPTIONS = [
    { value: "", label: "—" },
    { value: "SCRIPT", label: "Script" },
    { value: "MAP", label: "Map" },
    { value: "CAR", label: "Car" },
    { value: "CLOTHES", label: "Clothes" },
    { value: "OTHER", label: "Other / misc" },
];

export function EditIssueDetailsForm({ issue }: { issue: IssueForEdit }) {
    const [priority, setPriority] = useState<string>(normalizePriority(issue.priority));
    const [severity, setSeverity] = useState<string>(normalizeSeverity(issue.severity));
    const [label, setLabel] = useState<string>(issue.label ?? "");
    const [submitting, setSubmitting] = useState(false);
    const dueStr = issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : "";

    return (
        <details className="rounded-xl border border-default-100 bg-background/50 backdrop-blur-md shadow-sm overflow-hidden group">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-foreground hover:bg-default-50/50 [&::-webkit-details-marker]:hidden flex flex-col transition-colors">
                <span className="flex items-center justify-between w-full">
                    <span>Edit details</span>
                    <span className="text-xs text-primary font-semibold group-open:hidden">Expand</span>
                    <span className="text-xs text-default-450 font-semibold hidden group-open:inline">Collapse</span>
                </span>
                <p className="mt-1 text-xs font-medium text-default-450">
                    Status, type, and assignee live in the sidebar. Use this for narrative fields, tags,
                    and scheduling.
                </p>
            </summary>
            <form
                action={async (formData) => {
                    setSubmitting(true);
                    try {
                        await saveIssueDetails(formData);
                    } finally {
                        setSubmitting(false);
                    }
                }}
                className="space-y-5 border-t border-default-100 p-5 bg-default-50/10"
            >
                <input type="hidden" name="issueId" value={issue.id} />
                <input type="hidden" name="priority" value={priority} />
                <input type="hidden" name="severity" value={severity} />
                <input type="hidden" name="label" value={label} />

                {/* Title */}
                <TextField className="flex flex-col gap-1.5" isRequired>
                    <Label className="text-xs font-semibold text-foreground/80">Title</Label>
                    <Input
                        id="edit-title"
                        name="title"
                        defaultValue={issue.title}
                        placeholder="Issue title"
                        className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                    />
                </TextField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Priority Dropdown */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-foreground/80">Priority</span>
                        <Dropdown>
                            <DropdownTrigger
                                className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                )}
                            >
                                <span className="flex items-center gap-2">
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

                    {/* Severity Dropdown */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-foreground/80">Severity</span>
                        <Dropdown>
                            <DropdownTrigger
                                className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                )}
                            >
                                <span>
                                    {SEVERITY_OPTIONS.find(o => o.value === severity)?.label || severity}
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Due Date */}
                    <TextField className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Due date</Label>
                        <Input
                            id="edit-due"
                            name="dueDate"
                            type="date"
                            defaultValue={dueStr}
                            className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                        />
                    </TextField>

                    {/* Story Points */}
                    <TextField className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Story points</Label>
                        <Input
                            id="edit-points"
                            name="storyPoints"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="—"
                            defaultValue={issue.storyPoints ?? ""}
                            className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                        />
                    </TextField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tags */}
                    <TextField className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Tags</Label>
                        <Input
                            id="edit-tags"
                            name="tags"
                            defaultValue={issue.tags ?? ""}
                            placeholder="comma separated"
                            className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                        />
                    </TextField>

                    {/* Label Dropdown */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-foreground/80">Label / category</span>
                        <Dropdown>
                            <DropdownTrigger
                                className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                )}
                            >
                                <span>
                                    {LABEL_OPTIONS.find(o => o.value === label)?.label || "—"}
                                </span>
                            </DropdownTrigger>
                            <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                <DropdownMenu
                                    aria-label="Select Label"
                                    selectionMode="single"
                                    selectedKeys={new Set([label])}
                                    onSelectionChange={(keys) => setLabel(Array.from(keys)[0] as string)}
                                >
                                    {LABEL_OPTIONS.map((opt) => (
                                        <DropdownItem key={opt.value}>
                                            {opt.label}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </DropdownPopover>
                        </Dropdown>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Resource */}
                    <TextField className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Resource</Label>
                        <Input
                            id="edit-resource"
                            name="resourceName"
                            defaultValue={issue.resourceName ?? ""}
                            placeholder="E.g. police-mdt"
                            className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm font-mono text-foreground transition-all"
                        />
                    </TextField>

                    {/* Server/Build */}
                    <TextField className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/80">Server / build</Label>
                        <Input
                            id="edit-build"
                            name="serverVersion"
                            defaultValue={issue.serverVersion ?? ""}
                            placeholder="E.g. Build 2699"
                            className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm font-mono text-foreground transition-all"
                        />
                    </TextField>
                </div>

                {/* Environment */}
                <TextField className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-foreground/80">Environment</Label>
                    <Input
                        id="edit-env"
                        name="environment"
                        defaultValue={issue.environment ?? ""}
                        placeholder="e.g. live, staging, reproducible on FX 6683"
                        className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                    />
                </TextField>

                {/* Description */}
                <TextField className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-foreground/80">Description</Label>
                    <TextArea
                        id="edit-desc"
                        name="description"
                        rows={5}
                        defaultValue={issue.description ?? ""}
                        placeholder="Narrative description..."
                        className="w-full p-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all resize-y min-h-[120px]"
                    />
                </TextField>

                {/* Reproduction Steps */}
                <TextField className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-foreground/80">Steps to reproduce</Label>
                    <TextArea
                        id="edit-repro"
                        name="reproductionSteps"
                        rows={4}
                        defaultValue={issue.reproductionSteps ?? ""}
                        placeholder="Steps to reproduce..."
                        className="w-full p-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all resize-y min-h-[100px]"
                    />
                </TextField>

                {/* Expected Behavior */}
                <TextField className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-foreground/80">Expected behavior</Label>
                    <TextArea
                        id="edit-expected"
                        name="expectedBehavior"
                        rows={3}
                        defaultValue={issue.expectedBehavior ?? ""}
                        placeholder="Expected behavior..."
                        className="w-full p-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all resize-y min-h-[80px]"
                    />
                </TextField>

                <div className="flex justify-end pt-2">
                    <Button 
                        type="submit" 
                        variant="primary" 
                        size="md" 
                        isDisabled={submitting}
                        className="font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save details
                    </Button>
                </div>
            </form>
        </details>
    );
}
