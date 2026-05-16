import { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone =
    | "neutral"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "purple";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: Tone;
    size?: "xs" | "sm";
}

const TONES: Record<Tone, string> = {
    neutral:
        "bg-muted text-muted-foreground border-border",
    primary:
        "bg-primary/12 text-primary border-primary/30",
    success:
        "bg-success/12 text-success border-success/30",
    warning:
        "bg-warning/12 text-warning border-warning/30",
    danger:
        "bg-danger/12 text-danger border-danger/30",
    info:
        "bg-info/12 text-info border-info/30",
    purple:
        "bg-[color:rgb(149_125_255_/_0.12)] text-[color:rgb(149_125_255)] border-[color:rgb(149_125_255_/_0.3)]",
};

const SIZES = {
    xs: "h-5 px-1.5 text-[10px] gap-1",
    sm: "h-6 px-2 text-[11px] gap-1.5",
};

export function Badge({
    tone = "neutral",
    size = "sm",
    className,
    children,
    ...rest
}: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded border font-medium tracking-tight",
                TONES[tone],
                SIZES[size],
                className
            )}
            {...rest}
        >
            {children}
        </span>
    );
}
