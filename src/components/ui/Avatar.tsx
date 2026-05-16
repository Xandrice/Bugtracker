import { cn } from "./cn";

interface AvatarProps {
    name?: string | null;
    src?: string | null;
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}

const SIZES = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-6 w-6 text-[11px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
};

export function Avatar({ name, src, size = "sm", className }: AvatarProps) {
    const initial = name?.trim().charAt(0).toUpperCase() || "?";
    if (src) {
        return (
            <img
                src={src}
                alt={name || "User"}
                className={cn(
                    "rounded-full border border-border object-cover bg-muted shrink-0",
                    SIZES[size],
                    className
                )}
            />
        );
    }
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-full border border-border bg-muted text-muted-foreground font-semibold shrink-0",
                SIZES[size],
                className
            )}
        >
            {initial}
        </span>
    );
}
