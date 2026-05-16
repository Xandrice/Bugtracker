import { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * Collapsible-style section used in detail sidebars. Uses native <details>
 * so it works without JS.
 */
export function Section({
    title,
    children,
    defaultOpen = true,
    action,
    className,
}: {
    title: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <details
            open={defaultOpen}
            className={cn(
                "group rounded-md border border-border bg-surface",
                className
            )}
        >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
                <span>{title}</span>
                {action ? (
                    <span onClick={(e) => e.preventDefault()} className="ml-auto">
                        {action}
                    </span>
                ) : (
                    <svg
                        className="h-3 w-3 transition-transform group-open:rotate-180"
                        viewBox="0 0 12 12"
                        fill="none"
                    >
                        <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </summary>
            <div className="border-t border-border p-3">{children}</div>
        </details>
    );
}

export const Meta = ({
    label,
    children,
    className,
}: {
    label: ReactNode;
    children: ReactNode;
    className?: string;
}) => (
    <div className={cn("flex flex-col gap-1", className)}>
        <span className="text-[10px] font-medium uppercase tracking-wider text-subtle-foreground">
            {label}
        </span>
        <div className="text-sm text-foreground">{children}</div>
    </div>
);

export const Divider = ({ className }: { className?: string }) => (
    <div className={cn("h-px w-full bg-border", className)} />
);

export const EmptyState = ({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) => (
    <div
        className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface/50 px-6 py-12 text-center",
            className
        )}
    >
        {icon && <div className="text-subtle-foreground">{icon}</div>}
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description && (
            <p className="max-w-md text-xs text-muted-foreground">{description}</p>
        )}
        {action && <div className="pt-2">{action}</div>}
    </div>
);
