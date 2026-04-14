import Link from "next/link";
import { Bug, Search, Bell, Settings, UserCircle, LogOut, ChevronDown } from "lucide-react";
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
                <Link href="/settings" className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted transition-colors hidden sm:block border border-border/70">
                    <Settings className="h-3.5 w-3.5" />
                </Link>

                {session?.user ? (
                    <details className="relative">
                        <summary className="list-none flex items-center gap-1.5 cursor-pointer rounded-sm border border-border/70 px-1.5 py-1 hover:bg-muted transition-colors [&::-webkit-details-marker]:hidden">
                            {session.user.image ? (
                                <img
                                    src={session.user.image}
                                    alt="User profile"
                                    className="h-6 w-6 rounded-full border border-border object-cover"
                                />
                            ) : (
                                <div className="h-6 w-6 rounded-full border border-border bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                                    {session.user.name?.charAt(0).toUpperCase() || "U"}
                                </div>
                            )}
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </summary>
                        <div className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-background/95 p-1 shadow-lg shadow-black/35 backdrop-blur">
                            <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border/70">
                                {session.user.name || "Signed in"}
                            </div>
                            <Link href="/settings" className="mt-1 flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                                <Settings className="h-3.5 w-3.5" />
                                Settings
                            </Link>
                            <Link href="/api/auth/signout?callbackUrl=/" className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 transition-colors">
                                <LogOut className="h-3.5 w-3.5" />
                                Log out
                            </Link>
                        </div>
                    </details>
                ) : (
                    <Link href="/api/auth/signin?provider=discord&callbackUrl=/issues">
                        <UserCircle className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                    </Link>
                )}
            </div>
        </header>
    );
}
