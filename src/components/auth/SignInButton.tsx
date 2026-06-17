import { UserCircle } from "lucide-react";
import { signInWithDiscord } from "@/app/auth-actions";
import { cn } from "@/components/ui/cn";

type SignInButtonProps = {
    callbackUrl?: string;
    label?: string;
    className?: string;
};

export function SignInButton({
    callbackUrl = "/",
    label = "Sign in",
    className,
}: SignInButtonProps) {
    const action = signInWithDiscord.bind(null, callbackUrl);

    return (
        <form action={action}>
            <button
                type="submit"
                className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-border px-2 h-7 text-xs font-medium text-foreground hover:bg-muted transition-colors",
                    className
                )}
            >
                <UserCircle className="h-3.5 w-3.5" />
                {label}
            </button>
        </form>
    );
}
