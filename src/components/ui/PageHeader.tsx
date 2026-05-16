import { ReactNode } from "react";
import { cn } from "./cn";

interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
    eyebrow?: ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    icon,
    actions,
    eyebrow,
    className,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between",
                className
            )}
        >
            <div className="flex items-start gap-3 min-w-0">
                {icon && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
                        {icon}
                    </div>
                )}
                <div className="min-w-0 space-y-1">
                    {eyebrow && (
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {eyebrow}
                        </div>
                    )}
                    <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
            )}
        </div>
    );
}

export function PageContainer({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                "mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6",
                className
            )}
        >
            {children}
        </div>
    );
}
