import Link from "next/link";
import { Bug, Search, Bell, Settings, UserCircle } from "lucide-react";
import { auth } from "@/../auth";
import { ThemeToggle } from "./ThemeToggle";

export async function TopNavbar() {
    const session = await auth();

    return (
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6 shrink-0 shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-foreground transition-opacity hover:opacity-90">
                    <Bug className="h-6 w-6 text-primary" />
                    <span className="text-lg tracking-tight hidden sm:block bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">FiveM Tracker</span>
                </Link>
            </div>

            <div className="flex flex-1 items-center justify-center px-6 max-w-2xl hidden md:flex">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search issues, boards, notes..."
                        className="w-full rounded-md border border-input bg-muted/50 px-9 py-1.5 text-sm shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary h-9"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <ThemeToggle />
                <button className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors">
                    <Bell className="h-5 w-5" />
                </button>
                <button className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors hidden sm:block">
                    <Settings className="h-5 w-5" />
                </button>

                {session?.user ? (
                    session.user.image ? (
                        <img
                            src={session.user.image}
                            alt="User profile"
                            className="h-8 w-8 rounded-full border border-border cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all object-cover"
                        />
                    ) : (
                        <div className="h-8 w-8 rounded-full border border-border cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                            {session.user.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                    )
                ) : (
                    <Link href="/api/auth/signin">
                        <UserCircle className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                    </Link>
                )}
            </div>
        </header>
    );
}
