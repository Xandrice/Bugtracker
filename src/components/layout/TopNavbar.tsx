import Link from "next/link";
import { Bug, Search, Bell, Settings, UserCircle } from "lucide-react";
import { auth } from "@/../auth";
import { ThemeToggle } from "./ThemeToggle";

export async function TopNavbar() {
    const session = await auth();

    return (
        <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border/90 bg-background/95 px-3 lg:px-4 shrink-0 shadow-lg shadow-black/30 transition-colors duration-200 backdrop-blur">
            <div className="pointer-events-none absolute inset-0 opacity-20 bg-[url('/gta-stripes.svg')] bg-cover bg-center" />
            <div className="flex items-center gap-4">
                <Link href="/" className="relative z-10 flex items-center gap-2 font-bold text-foreground transition-opacity hover:opacity-90">
                    <Bug className="h-4 w-4 text-accent" />
                    <span className="font-display text-base uppercase tracking-[0.16em] hidden sm:block">Renegade Roleplay</span>
                    <span className="gta-label hidden md:block">Issue Tracker</span>
                </Link>
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-center px-4 max-w-2xl hidden md:flex">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Scan reports, jobs, files..."
                        className="w-full rounded-sm border border-border/80 bg-muted/35 px-8 py-1 text-xs uppercase tracking-[0.08em] shadow-inner shadow-black/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary h-7"
                    />
                </div>
            </div>

            <div className="relative z-10 flex items-center gap-2">
                <ThemeToggle />
                <button className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted transition-colors border border-border/70">
                    <Bell className="h-3.5 w-3.5" />
                </button>
                <button className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted transition-colors hidden sm:block border border-border/70">
                    <Settings className="h-3.5 w-3.5" />
                </button>

                {session?.user ? (
                    session.user.image ? (
                        <img
                            src={session.user.image}
                            alt="User profile"
                            className="h-7 w-7 rounded-full border border-border cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:ring-offset-background transition-all object-cover"
                        />
                    ) : (
                        <div className="h-7 w-7 rounded-full border border-border cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 text-xs">
                            {session.user.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                    )
                ) : (
                    <Link href="/api/auth/signin?provider=discord&callbackUrl=/issues">
                        <UserCircle className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                    </Link>
                )}
            </div>
        </header>
    );
}
