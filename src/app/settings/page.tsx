"use client";

import { useState, useEffect } from "react";
import { Settings2, Database, Palette, Check, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { exportProjectData, deleteAllProjectData } from "@/app/actions";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("general");
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isExporting, setIsExporting] = useState<false | "json" | "csv">(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [projectName, setProjectName] = useState("BugTracker");
    const [projectDesc, setProjectDesc] = useState("A free, premium bug tracker with kanban boards and shared notes.");

    useEffect(() => {
        setMounted(true);
        const storedName = localStorage.getItem("bugtracker_name");
        const storedDesc = localStorage.getItem("bugtracker_desc");
        if (storedName) setProjectName(storedName);
        if (storedDesc) setProjectDesc(storedDesc);
    }, []);

    const saveGeneralSettings = () => {
        localStorage.setItem("bugtracker_name", projectName);
        localStorage.setItem("bugtracker_desc", projectDesc);
        alert("Settings saved locally!");
    };

    const tabs = [
        { id: "general", label: "General", icon: Settings2 },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "export", label: "Data Export", icon: Database },
    ];

    const handleExportJSON = async () => {
        setIsExporting("json");
        try {
            const data = await exportProjectData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bugtracker-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert("Failed to export data");
        }
        setIsExporting(false);
    };

    const handleExportCSV = async () => {
        setIsExporting("csv");
        try {
            const data = await exportProjectData();

            // Basic CSV of issues
            const headers = ["ID", "Title", "Type", "Priority", "Status", "Reporter", "Assignee", "Created At"];
            const rows = data.issues.map((issue: any) => [
                issue.id,
                `"${(issue.title || "").replace(/"/g, '""')}"`,
                issue.type,
                issue.priority,
                issue.status,
                `"${(issue.reporter?.name || "Unknown").replace(/"/g, '""')}"`,
                `"${(issue.assignee?.name || "Unassigned").replace(/"/g, '""')}"`,
                new Date(issue.createdAt).toISOString()
            ]);

            const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bugtracker-issues-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert("Failed to export data");
        }
        setIsExporting(false);
    };

    return (
        <div className="flex flex-col h-full p-6 max-w-[1200px] mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg">
                    <Settings2 className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Project Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your project preferences and integrations.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="col-span-1 border-r pr-6 space-y-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-md text-sm font-medium transition-colors border-l-2 ${isActive
                                    ? "bg-primary/10 text-primary border-primary"
                                    : "text-muted-foreground hover:bg-muted border-transparent"
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="md:col-span-3 space-y-6">
                    {activeTab === "general" && (
                        <>
                            <div className="bg-background border rounded-xl shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b bg-muted/30">
                                    <h3 className="font-semibold">Project Details</h3>
                                    <p className="text-xs text-muted-foreground">Basic information about your project.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="py-2 px-3 text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900 rounded-md">
                                        These settings are currently persisted locally while we wait for backend API support.
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Project Name</label>
                                        <input
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description</label>
                                        <textarea
                                            value={projectDesc}
                                            onChange={(e) => setProjectDesc(e.target.value)}
                                            className="w-full flex rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[100px]"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={saveGeneralSettings}
                                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === "appearance" && (
                        <div className="bg-background border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b bg-muted/30">
                                <h3 className="font-semibold">Appearance Settings</h3>
                                <p className="text-xs text-muted-foreground">Customize the look and feel of the application.</p>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium block">Theme Options</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div
                                            onClick={() => setTheme('light')}
                                            className={`border rounded-md p-4 text-center cursor-pointer hover:border-primary shadow-sm relative ${mounted && theme === 'light' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'bg-background'}`}
                                        >
                                            {mounted && theme === 'light' && <Check className="absolute top-2 right-2 text-primary w-4 h-4" />}
                                            <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto mb-2 border shadow-inner"></div>
                                            <span className="text-sm font-medium">Light</span>
                                        </div>
                                        <div
                                            onClick={() => setTheme('dark')}
                                            className={`border rounded-md p-4 text-center cursor-pointer hover:border-primary shadow-sm relative ${mounted && theme === 'dark' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'bg-background'}`}
                                        >
                                            {mounted && theme === 'dark' && <Check className="absolute top-2 right-2 text-primary w-4 h-4" />}
                                            <div className="w-8 h-8 rounded-full bg-slate-900 mx-auto mb-2 border border-slate-700 shadow-inner"></div>
                                            <span className="text-sm font-medium">Dark</span>
                                        </div>
                                        <div
                                            onClick={() => setTheme('system')}
                                            className={`border rounded-md p-4 text-center cursor-pointer hover:border-primary shadow-sm relative ${mounted && theme === 'system' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'bg-background'}`}
                                        >
                                            {mounted && theme === 'system' && <Check className="absolute top-2 right-2 text-primary w-4 h-4" />}
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-100 to-slate-900 mx-auto mb-2 border shadow-inner"></div>
                                            <span className="text-sm font-medium">System Default</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "export" && (
                        <div className="space-y-6">
                            <div className="bg-background border rounded-xl shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b bg-muted/30">
                                    <h3 className="font-semibold">Data Export</h3>
                                    <p className="text-xs text-muted-foreground">Export your project data indefinitely.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        You can export all your project data, including issues, users, and notes, into a JSON or CSV format. The generation process might take a few minutes depending on the size of your project.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleExportCSV}
                                            disabled={isExporting !== false}
                                            className="border px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isExporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                                            {isExporting === "csv" ? "Exporting..." : "Export as CSV"}
                                        </button>
                                        <button
                                            onClick={handleExportJSON}
                                            disabled={isExporting !== false}
                                            className="border px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isExporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                                            {isExporting === "json" ? "Exporting..." : "Export as JSON"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl overflow-hidden shadow-sm">
                                <div className="px-6 py-4 border-b border-red-200 dark:border-red-900 bg-red-100/50 dark:bg-red-900/20 relative">
                                    <h3 className="font-semibold text-red-800 dark:text-red-400">Danger Zone</h3>
                                </div>
                                <div className="p-6">
                                    <p className="text-sm text-red-800 dark:text-red-400 mb-4">Once you delete project data, there is no going back. All issues, notes, and activity will be cleared.</p>
                                    <button
                                        onClick={async () => {
                                            if (confirm("Are you absolutely sure you want to delete all project data? This cannot be undone.")) {
                                                setIsDeleting(true);
                                                try {
                                                    await deleteAllProjectData();
                                                } catch (e) {
                                                    alert("Failed to delete project data");
                                                    setIsDeleting(false);
                                                }
                                            }
                                        }}
                                        disabled={isDeleting}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        {isDeleting ? "Deleting..." : "Delete All Project Data"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
