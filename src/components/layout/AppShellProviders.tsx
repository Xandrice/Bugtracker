"use client";

import { QuickCreateProvider } from "@/components/issues/QuickCreateIssue";

export function AppShellProviders({
    children,
    canCreate,
}: {
    children: React.ReactNode;
    canCreate: boolean;
}) {
    return <QuickCreateProvider enabled={canCreate}>{children}</QuickCreateProvider>;
}
