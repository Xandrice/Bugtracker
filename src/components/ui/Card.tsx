import { HTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    function Card({ className, ...rest }, ref) {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-md border border-border bg-surface",
                    className
                )}
                {...rest}
            />
        );
    }
);

export const CardHeader = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 border-b border-border",
            className
        )}
        {...rest}
    />
);

export const CardTitle = ({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
        className={cn("text-sm font-semibold text-foreground", className)}
        {...rest}
    />
);

export const CardDescription = ({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) => (
    <p
        className={cn("text-xs text-muted-foreground", className)}
        {...rest}
    />
);

export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("p-4", className)} {...rest} />
);

export const CardFooter = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-2",
            className
        )}
        {...rest}
    />
);
