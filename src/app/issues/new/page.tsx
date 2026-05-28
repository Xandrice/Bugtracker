"use client";

import { ArrowLeft, Save, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import { createIssue } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { PageContainer } from "@/components/ui/PageHeader";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
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
    Description,
    buttonVariants,
    cn,
} from "@heroui/react";
import {
    PRIORITY_OPTIONS,
    SEVERITY_OPTIONS,
    TYPE_OPTIONS,
    PRIORITY_META,
    TYPE_META,
    type IssuePriority,
    type IssueType,
} from "@/lib/issue-tokens";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button 
            type="submit" 
            variant="primary" 
            size="md" 
            isDisabled={pending}
            className="font-semibold shadow-sm flex items-center justify-center gap-1.5"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                className="inline-flex w-fit items-center gap-1.5 text-xs text-default-500 hover:text-foreground transition-colors font-semibold"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to issues
            </Link>

            <form action={createIssue}>
                <Card className="border border-default-100 bg-background/50 backdrop-blur-md shadow-sm rounded-xl">
                    <CardHeader className="flex flex-col items-start gap-1 p-5 border-b border-default-100 bg-default-50/20">
                        <h2 className="text-xl font-bold text-foreground">New issue</h2>
                        <p className="text-xs text-default-450 font-medium">
                            Submit a bug, feature request, or task. Include resource name and steps to
                            reproduce when relevant.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6 p-5">
                        {/* Title */}
                        <TextField className="flex flex-col gap-1.5" isRequired>
                            <Label className="text-xs font-semibold text-foreground/80">Title</Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="E.g. Police MDT fails to load when off duty"
                                className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                            />
                        </TextField>

                        {/* Row 1: Type, Priority, Severity */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Type Dropdown */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-foreground/80">Type</span>
                                <input type="hidden" name="type" value={type} />
                                <Dropdown>
                                    <DropdownTrigger
                                        id="type-select"
                                        className={cn(
                                            buttonVariants({ variant: "outline" }),
                                            "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            {TYPE_META[type as IssueType].icon}
                                            {TYPE_META[type as IssueType].label}
                                        </span>
                                    </DropdownTrigger>
                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg">
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

                            {/* Priority Dropdown */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-foreground/80">Priority</span>
                                <input type="hidden" name="priority" value={priority} />
                                <Dropdown>
                                    <DropdownTrigger
                                        id="priority-select"
                                        className={cn(
                                            buttonVariants({ variant: "outline" }),
                                            "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            {PRIORITY_META[priority as IssuePriority].icon}
                                            {PRIORITY_META[priority as IssuePriority].label}
                                        </span>
                                    </DropdownTrigger>
                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg">
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
                                <input type="hidden" name="severity" value={severity} />
                                <Dropdown>
                                    <DropdownTrigger
                                        id="severity-select"
                                        className={cn(
                                            buttonVariants({ variant: "outline" }),
                                            "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                        )}
                                    >
                                        <span>
                                            {SEVERITY_OPTIONS.find(o => o.value === severity)?.short || severity}
                                        </span>
                                    </DropdownTrigger>
                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg">
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
                                <p className="text-[10px] text-default-450 leading-tight font-medium">
                                    {SEVERITY_HINT[severity]}
                                </p>
                            </div>
                        </div>

                        {/* Row 2: Tags & Label */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField className="flex flex-col gap-1.5">
                                <Label className="text-xs font-semibold text-foreground/80">Tags</Label>
                                <Input
                                    id="tags"
                                    name="tags"
                                    placeholder="resource:police-mdt, ui, lua"
                                    className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                                />
                            </TextField>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-foreground/80">Label / category</span>
                                <input type="hidden" name="label" value={label} />
                                <Dropdown>
                                    <DropdownTrigger
                                        id="label-select"
                                        className={cn(
                                            buttonVariants({ variant: "outline" }),
                                            "w-full h-10 justify-between px-3 text-sm border-default-200 hover:border-default-400 bg-default-50/50 text-foreground font-semibold cursor-pointer focus:outline-none"
                                        )}
                                    >
                                        <span>
                                            {LABEL_OPTIONS.find(o => o.value === label)?.label || "—"}
                                        </span>
                                    </DropdownTrigger>
                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg">
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

                        {/* Due Date */}
                        <TextField className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-foreground/80">Due date</Label>
                            <div className="relative flex items-center">
                                <Calendar className="absolute left-3 h-4 w-4 text-default-450 pointer-events-none" />
                                <Input
                                    id="dueDate"
                                    name="dueDate"
                                    type="date"
                                    className="w-full h-10 pl-10 pr-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all"
                                />
                            </div>
                        </TextField>

                        {/* Discord Post */}
                        <TextField className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-foreground/80">Discord forum post (optional)</Label>
                            <Input
                                id="discordPostId"
                                name="discordPostId"
                                placeholder="https://discord.com/channels/.../1489040926197289083"
                                className="w-full h-10 px-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm font-mono text-foreground transition-all"
                            />
                            <Description className="text-[10px] text-default-450 mt-0.5">
                                Paste a Discord post link or post ID — the bot will add a tracker notice.
                            </Description>
                        </TextField>

                        {/* Description */}
                        <TextField className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-foreground/80">Description</Label>
                            <TextArea
                                id="description"
                                name="description"
                                rows={5}
                                placeholder="What happened or what do you want? Be specific."
                                className="w-full p-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all resize-y min-h-[120px]"
                            />
                        </TextField>

                        {/* Reproduction Steps */}
                        <TextField className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-foreground/80">Steps to reproduce (bugs)</Label>
                            <TextArea
                                id="reproductionSteps"
                                name="reproductionSteps"
                                rows={4}
                                placeholder="1. Go to… 2. Click… 3. See error"
                                className="w-full p-3 bg-default-50/50 border border-default-200 hover:border-default-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg text-sm text-foreground transition-all resize-y min-h-[100px]"
                            />
                        </TextField>
                    </CardContent>
                    <CardFooter className="flex items-center justify-end gap-3 p-5 border-t border-default-100 bg-default-50/20">
                        <Link
                            href="/issues"
                            className="inline-flex items-center justify-center rounded-lg border border-default-200 bg-transparent px-4 h-10 text-sm font-semibold text-default-600 hover:bg-default-100 hover:text-foreground transition-colors"
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
