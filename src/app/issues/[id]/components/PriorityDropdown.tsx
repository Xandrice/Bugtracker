"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

const PRIORITY_OPTIONS = [
    { value: "URGENT", short: "P0" },
    { value: "HIGH", short: "P1" },
    { value: "MEDIUM", short: "P2" },
    { value: "LOW", short: "P3" },
] as const;

type PriorityValue = (typeof PRIORITY_OPTIONS)[number]["value"];

export default function PriorityDropdown({ defaultValue }: { defaultValue: string }) {
    const normalizedDefault = useMemo<PriorityValue>(() => {
        if (defaultValue === "URGENT" || defaultValue === "HIGH" || defaultValue === "MEDIUM" || defaultValue === "LOW") {
            return defaultValue;
        }
        return "MEDIUM";
    }, [defaultValue]);

    const [value, setValue] = useState<PriorityValue>(normalizedDefault);
    const [open, setOpen] = useState(false);

    const active = PRIORITY_OPTIONS.find((p) => p.value === value) ?? PRIORITY_OPTIONS[2];

    return (
        <div className="relative">
            <input type="hidden" name="priority" value={value} />
            <button
                type="button"
                className="w-full rounded-lg border border-input px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                <span className="font-semibold tracking-[0.06em]">{active.short}</span>
                <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-input bg-card shadow-lg p-1" role="listbox">
                    {PRIORITY_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={clsx(
                                "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                option.value === value
                                    ? "bg-primary/20 text-foreground border border-primary/40"
                                    : "text-foreground/90 hover:bg-muted/70 border border-transparent"
                            )}
                            onClick={() => {
                                setValue(option.value);
                                setOpen(false);
                            }}
                        >
                            <span className="font-semibold tracking-[0.06em]">{option.short}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
