import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function Input({ className, ...rest }, ref) {
        return (
            <input
                ref={ref}
                className={cn(
                    "h-9 w-full rounded-md border border-input bg-elevated px-3 text-sm text-foreground placeholder:text-subtle-foreground transition-colors focus-ring hover:border-border-strong",
                    className
                )}
                {...rest}
            />
        );
    }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
    function Textarea({ className, ...rest }, ref) {
        return (
            <textarea
                ref={ref}
                className={cn(
                    "block w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground transition-colors focus-ring resize-y min-h-[90px] hover:border-border-strong",
                    className
                )}
                {...rest}
            />
        );
    }
);

export const Label = ({
    className,
    ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label
        className={cn(
            "text-xs font-medium text-muted-foreground select-none",
            className
        )}
        {...rest}
    />
);

export const FieldRow = ({
    children,
    label,
    htmlFor,
    hint,
    className,
}: {
    children: React.ReactNode;
    label: string;
    htmlFor?: string;
    hint?: string;
    className?: string;
}) => (
    <div className={cn("space-y-1.5", className)}>
        <Label htmlFor={htmlFor}>{label}</Label>
        {children}
        {hint && <p className="text-[11px] text-subtle-foreground">{hint}</p>}
    </div>
);
