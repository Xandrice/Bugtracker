"use client";

import { useState, useEffect } from "react";
import { Settings2, Database, Palette, Check, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
    exportProjectData,
    deleteAllProjectData,
    getDiscordForumSettings,
    saveDiscordForumSettings,
} from "@/app/actions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldRow, Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("general");
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isExporting, setIsExporting] = useState<false | "json" | "csv">(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSavingForums, setIsSavingForums] = useState(false);

    const [suggestionsForumId, setSuggestionsForumId] = useState("");
    const [bugsForumId, setBugsForumId] = useState("");

    useEffect(() => {
        setMounted(true);
        (async () => {
            try {
                const settings = await getDiscordForumSettings();
                setSuggestionsForumId(settings.suggestionsForumId);
                setBugsForumId(settings.bugsForumId);
            } catch {}
        })();
    }, []);

    const saveForumSettings = async () => {
        setIsSavingForums(true);
        try {
            await saveDiscordForumSettings({ suggestionsForumId, bugsForumId });
            alert("Discord forum settings saved.");
        } catch {
            alert("Failed to save Discord forum settings.");
        } finally {
            setIsSavingForums(false);
        }
    };

    const tabs = [
        { id: "general", label: "Integrations", icon: Settings2 },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "export", label: "Data export", icon: Database },
    ];

    const handleExportJSON = async () => {
        setIsExporting("json");
        try {
            const data = await exportProjectData();
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bugtracker-export-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert("Failed to export data");
        }
        setIsExporting(false);
    };

    const handleExportCSV = async () => {
        setIsExporting("csv");
        try {
            const data = await exportProjectData();
            const headers = ["ID", "Title", "Type", "Priority", "Status", "Reporter", "Assignee", "Created At"];
            const rows = data.issues.map((issue: any) => [
                issue.id,
                `"${(issue.title || "").replace(/"/g, '""')}"`,
                issue.type,
                issue.priority,
                issue.status,
                `"${(issue.reporter?.name || "Unknown").replace(/"/g, '""')}"`,
                `"${(issue.assignee?.name || "Unassigned").replace(/"/g, '""')}"`,
                new Date(issue.createdAt).toISOString(),
            ]);
            const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bugtracker-issues-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert("Failed to export data");
        }
        setIsExporting(false);
    };

    return (
        <PageContainer className="max-w-[1200px]">
            <PageHeader
                title="Settings"
                description="Manage Discord integration, appearance, and project data."
                icon={<Settings2 className="h-4 w-4" />}
            />

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
                <nav className="space-y-0.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/12 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="space-y-5">
                    {activeTab === "general" && (
                        <Card>
                            <CardHeader>
                                <div className="space-y-1">
                                    <CardTitle>Discord forums</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Configure forum parent IDs used by webhook filtering.
                                    </p>
                                </div>
                            </CardHeader>
                            <CardBody className="space-y-4">
                                <FieldRow label="Suggestions forum ID">
                                    <Input
                                        value={suggestionsForumId}
                                        onChange={(e) => setSuggestionsForumId(e.target.value)}
                                        className="font-mono"
                                        placeholder="e.g. 123456789012345678"
                                    />
                                </FieldRow>
                                <FieldRow label="Bugs forum ID">
                                    <Input
                                        value={bugsForumId}
                                        onChange={(e) => setBugsForumId(e.target.value)}
                                        className="font-mono"
                                        placeholder="e.g. 987654321098765432"
                                    />
                                </FieldRow>
                                <Button
                                    type="button"
                                    onClick={saveForumSettings}
                                    disabled={isSavingForums}
                                    variant="primary"
                                    size="md"
                                >
                                    {isSavingForums && (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {isSavingForums ? "Saving…" : "Save Discord forums"}
                                </Button>
                            </CardBody>
                        </Card>
                    )}

                    {activeTab === "appearance" && (
                        <Card>
                            <CardHeader>
                                <div className="space-y-1">
                                    <CardTitle>Appearance</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Customize the look and feel of the application.
                                    </p>
                                </div>
                            </CardHeader>
                            <CardBody className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">Theme</p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {(["light", "dark", "system"] as const).map((opt) => {
                                        const active = mounted && theme === opt;
                                        const swatch =
                                            opt === "light"
                                                ? "bg-[#e6e8ec] border-[#cbd0d8]"
                                                : opt === "dark"
                                                    ? "bg-[#0d0e10] border-[#24272d]"
                                                    : "bg-gradient-to-r from-[#e6e8ec] to-[#0d0e10] border-border";
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setTheme(opt)}
                                                className={cn(
                                                    "relative flex flex-col items-center gap-2 rounded-md border p-4 text-center text-xs transition-colors",
                                                    active
                                                        ? "border-primary bg-primary/8"
                                                        : "border-border hover:border-border-strong"
                                                )}
                                            >
                                                {active && (
                                                    <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
                                                )}
                                                <span
                                                    className={cn(
                                                        "h-7 w-7 rounded-full border",
                                                        swatch
                                                    )}
                                                />
                                                <span className="font-medium capitalize text-foreground">
                                                    {opt}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {activeTab === "export" && (
                        <div className="space-y-5">
                            <Card>
                                <CardHeader>
                                    <div className="space-y-1">
                                        <CardTitle>Data export</CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            Export all your project data as JSON or CSV.
                                        </p>
                                    </div>
                                </CardHeader>
                                <CardBody className="space-y-3">
                                    <p className="text-xs text-muted-foreground">
                                        Includes issues, users, and notes. The generation process may
                                        take a moment depending on project size.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            onClick={handleExportCSV}
                                            disabled={isExporting !== false}
                                            variant="outline"
                                            size="sm"
                                        >
                                            {isExporting === "csv" ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Database className="h-3.5 w-3.5" />
                                            )}
                                            {isExporting === "csv" ? "Exporting…" : "Export CSV"}
                                        </Button>
                                        <Button
                                            onClick={handleExportJSON}
                                            disabled={isExporting !== false}
                                            variant="outline"
                                            size="sm"
                                        >
                                            {isExporting === "json" ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Database className="h-3.5 w-3.5" />
                                            )}
                                            {isExporting === "json" ? "Exporting…" : "Export JSON"}
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="border-danger/30">
                                <CardHeader className="border-danger/20 bg-danger/5">
                                    <CardTitle className="text-danger">Danger zone</CardTitle>
                                </CardHeader>
                                <CardBody className="space-y-3">
                                    <p className="text-xs text-muted-foreground">
                                        Once you delete project data there is no going back. All issues,
                                        notes, links, and notifications will be cleared.
                                    </p>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={isDeleting}
                                        onClick={async () => {
                                            if (
                                                confirm(
                                                    "Are you absolutely sure you want to delete all project data? This cannot be undone."
                                                )
                                            ) {
                                                setIsDeleting(true);
                                                try {
                                                    await deleteAllProjectData();
                                                } catch {
                                                    alert("Failed to delete project data");
                                                    setIsDeleting(false);
                                                }
                                            }
                                        }}
                                    >
                                        {isDeleting && (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        )}
                                        {isDeleting ? "Deleting…" : "Delete all project data"}
                                    </Button>
                                </CardBody>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
