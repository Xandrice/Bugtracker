import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

import { TopNavbar } from "@/components/layout/TopNavbar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { GlobalSearchTrigger } from "@/components/layout/GlobalSearch";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { auth } from "@/../auth";
import {
    canViewLogs,
    canViewStaffEconomy,
    canViewStaffPlayers,
    canViewStaffVehicles,
    getPermissionContext,
} from "@/lib/permissions";
import { SITE_METADATA_DESCRIPTION, SITE_METADATA_TITLE } from "@/lib/site";

export const metadata: Metadata = {
    title: SITE_METADATA_TITLE,
    description: SITE_METADATA_DESCRIPTION,
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    const permissionContext = await getPermissionContext(session?.user?.id);
    const showLogs = canViewLogs(permissionContext);
    const staffToolAccess = {
        players: canViewStaffPlayers(permissionContext),
        vehicles: canViewStaffVehicles(permissionContext),
        economy: canViewStaffEconomy(permissionContext),
    };

    return (
        <html lang="en" suppressHydrationWarning className="h-full">
            <head>
                {/*
                  We ship our own dark mode, so ask Dark Reader / similar extensions
                  to leave the page alone. Without this they inject inline styles
                  into every SVG and trigger React hydration warnings.
                */}
                <meta name="darkreader-lock" />
                <meta name="color-scheme" content="light dark" />
            </head>
            <body
                suppressHydrationWarning
                className={`${geistSans.variable} ${geistMono.variable} antialiased h-full min-h-screen bg-background text-foreground overflow-hidden`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <div className="flex h-screen flex-col overflow-hidden">
                        <TopNavbar />
                        <div className="flex flex-1 min-h-0 overflow-hidden">
                            <LeftSidebar
                                isLoggedIn={!!session?.user?.id}
                                canViewLogs={showLogs}
                                staffToolAccess={staffToolAccess}
                            />
                            <main className="flex-1 min-h-0 overflow-y-auto bg-background">
                                {children}
                            </main>
                        </div>
                        <GlobalSearchTrigger />
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
