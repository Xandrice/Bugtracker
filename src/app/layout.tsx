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
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "FiveM Tracker - Bug & Feature Management",
  description: "Bug and feature tracker for FiveM server development with triage and issue workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased h-full min-h-screen bg-background text-foreground overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNavbar />
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <LeftSidebar />
              <main className="flex-1 overflow-y-auto bg-muted/10">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
