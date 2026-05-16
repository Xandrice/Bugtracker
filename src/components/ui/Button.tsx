import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
    primary:
        "bg-primary text-primary-foreground border border-primary hover:bg-primary/90 hover:border-primary/90 shadow-sm",
    secondary:
        "bg-elevated text-foreground border border-border hover:bg-muted hover:border-border-strong",
    outline:
        "bg-transparent text-foreground border border-border hover:bg-muted hover:border-border-strong",
    ghost:
        "bg-transparent text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground",
    danger:
        "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15 hover:border-danger/40",
    success:
        "bg-success/10 text-success border border-success/30 hover:bg-success/15 hover:border-success/40",
};

const SIZES: Record<Size, string> = {
    xs: "h-7 px-2 text-xs gap-1.5",
    sm: "h-8 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3.5 text-sm gap-2",
    lg: "h-10 px-4 text-sm gap-2",
    icon: "h-8 w-8 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "secondary", size = "sm", loading, className, children, disabled, ...rest },
    ref
) {
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                "inline-flex items-center justify-center rounded-md font-medium leading-none whitespace-nowrap transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none",
                VARIANTS[variant],
                SIZES[size],
                className
            )}
            {...rest}
        >
            {children}
        </button>
    );
});
