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
                "group rounded-xl border border-default-100 bg-default-50/20 backdrop-blur-md shadow-sm",
                className
            )}
        >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-default-450 hover:bg-default-50/40 rounded-t-xl [&::-webkit-details-marker]:hidden select-none">
                <span>{title}</span>
                {action ? (
                    <span onClick={(e) => e.preventDefault()} className="ml-auto">
                        {action}
                    </span>
                ) : (
                    <svg
                        className="h-3.5 w-3.5 transition-transform group-open:rotate-180 text-default-400"
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
            <div className="border-t border-default-100 p-3.5 bg-background/30 rounded-b-xl">{children}</div>
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-default-450">
            {label}
        </span>
        <div className="text-sm font-semibold text-foreground">{children}</div>
    </div>
);

export const Divider = ({ className }: { className?: string }) => (
    <div className={cn("h-px w-full bg-default-100", className)} />
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
            "flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-default-200 bg-default-50/10 px-6 py-10 text-center",
            className
        )}
    >
        {icon && <div className="text-default-405">{icon}</div>}
        <div className="text-sm font-bold text-foreground">{title}</div>
        {description && (
            <p className="max-w-md text-xs text-default-450 leading-relaxed">{description}</p>
        )}
        {action && <div className="pt-2">{action}</div>}
    </div>
);
