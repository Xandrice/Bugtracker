import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

import { TopNavbar } from "@/components/layout/TopNavbar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { auth } from "@/../auth";

export const metadata: Metadata = {
  title: "Renegade Roleplay Tracker",
  description: "GTA V-inspired issue and operations tracker for server teams.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased h-full min-h-screen bg-background text-foreground overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNavbar />
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <LeftSidebar isLoggedIn={!!session?.user?.id} />
              <main className="flex-1 overflow-y-auto bg-transparent">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
