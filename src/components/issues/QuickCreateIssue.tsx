"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { createIssue } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import { PRIORITY_OPTIONS, TYPE_OPTIONS } from "@/lib/issue-tokens";

type QuickCreateContextValue = {
    open: () => void;
    close: () => void;
    enabled: boolean;
};

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null);

export function useQuickCreate() {
    return useContext(QuickCreateContext);
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {pending ? "Creating…" : "Create"}
        </Button>
    );
}

function QuickCreateDialog({ onClose }: { onClose: () => void }) {
    const titleRef = useRef<HTMLInputElement>(null);
    const [type, setType] = useState("TASK");
    const [priority, setPriority] = useState("MEDIUM");

    useEffect(() => {
        titleRef.current?.focus();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-elevated shadow-pop"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="quick-create-title"
            >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 id="quick-create-title" className="text-sm font-semibold text-foreground">
                        Quick create
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form action={createIssue} className="space-y-4 p-4">
                    <input type="hidden" name="severity" value="MINOR" />

                    <FieldRow label="Title" htmlFor="quick-title">
                        <Input
                            ref={titleRef}
                            id="quick-title"
                            name="title"
                            placeholder="What needs to be done?"
                            required
                        />
                    </FieldRow>

                    <div className="grid grid-cols-2 gap-3">
                        <FieldRow label="Type" htmlFor="quick-type">
                            <Select
                                name="type"
                                value={type}
                                onChange={setType}
                                options={TYPE_OPTIONS}
                                size="sm"
                            />
                        </FieldRow>
                        <FieldRow label="Priority" htmlFor="quick-priority">
                            <Select
                                name="priority"
                                value={priority}
                                onChange={setPriority}
                                options={PRIORITY_OPTIONS}
                                size="sm"
                            />
                        </FieldRow>
                    </div>

                    <FieldRow label="Description (optional)" htmlFor="quick-description">
                        <Textarea
                            id="quick-description"
                            name="description"
                            rows={2}
                            placeholder="One-line context…"
                        />
                    </FieldRow>

                    <div className="flex items-center justify-between gap-3 pt-1">
                        <Link
                            href="/issues/new?type=BUG"
                            onClick={onClose}
                            className="text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                            Report a bug / more details
                        </Link>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                                Cancel
                            </Button>
                            <SubmitButton />
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function QuickCreateProvider({
    children,
    enabled = true,
}: {
    children: ReactNode;
    enabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const open = useCallback(() => {
        if (enabled) setIsOpen(true);
    }, [enabled]);
    const close = useCallback(() => setIsOpen(false), []);

    return (
        <QuickCreateContext.Provider value={{ open, close, enabled }}>
            {children}
            {enabled && isOpen && <QuickCreateDialog onClose={close} />}
        </QuickCreateContext.Provider>
    );
}

export function QuickCreateTrigger({
    className,
    children,
    fallbackHref = "/issues/new",
}: {
    className?: string;
    children?: ReactNode;
    fallbackHref?: string;
}) {
    const ctx = useQuickCreate();
    const content = children ?? (
        <>
            <Plus className="h-3.5 w-3.5" />
            New issue
        </>
    );

    if (!ctx?.enabled) {
        return (
            <Link href={fallbackHref} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <button type="button" onClick={ctx.open} className={cn(className)}>
            {content}
        </button>
    );
}
