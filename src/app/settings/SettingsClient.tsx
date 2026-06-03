"use client";

import { useEffect, useState } from "react";
import { Check, Database, KeyRound, Loader2, Palette, Settings2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
    createStaffRoleAction,
    deleteAllProjectData,
    deleteStaffRoleAction,
    exportProjectData,
    getDiscordForumSettings,
    renameStaffRoleAction,
    saveDiscordForumSettings,
    toggleStaffRolePermissionAction,
    updateStaffRoleBaseRoleAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { FieldRow, Input } from "@/components/ui/Input";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { PROJECT_ROLES } from "@/lib/permissions";
import {
    STAFF_PERMISSION_DEFINITIONS,
    getStaffPermissionValue,
    normalizeStaffPanelPermissions,
    type StaffPanelPermissions,
} from "@/lib/staff-permissions";

export type SettingsStaffRole = {
    id: string;
    name: string;
    baseRole: string;
    permissions: unknown;
    isSystem: boolean;
};

type ExportIssue = {
    id: string;
    title?: string | null;
    type?: string | null;
    priority?: string | null;
    status?: string | null;
    reporter?: { name?: string | null } | null;
    assignee?: { name?: string | null } | null;
    createdAt: string | Date;
};

type ExportPayload = {
    issues: ExportIssue[];
};

function PermissionToggleButton({
    roleId,
    permissions,
}: {
    roleId: string;
    permissions: StaffPanelPermissions;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {STAFF_PERMISSION_DEFINITIONS.map((permission) => {
                const active = getStaffPermissionValue(permissions, permission.key);
                return (
                    <form key={permission.key} action={toggleStaffRolePermissionAction}>
                        <input type="hidden" name="roleId" value={roleId} />
                        <input type="hidden" name="permissionKey" value={permission.key} />
                        <Button
                            type="submit"
                            size="xs"
                            variant={active ? "success" : "outline"}
                            title={permission.description}
                        >
                            {permission.label}
                        </Button>
                    </form>
                );
            })}
        </div>
    );
}

export function SettingsClient({
    canManagePermissions,
    staffRoles,
}: {
    canManagePermissions: boolean;
    staffRoles: SettingsStaffRole[];
}) {
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
        ...(canManagePermissions ? [{ id: "permissions", label: "Permissions", icon: KeyRound }] : []),
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
            const data = (await exportProjectData()) as ExportPayload;
            const headers = ["ID", "Title", "Type", "Priority", "Status", "Reporter", "Assignee", "Created At"];
            const rows = data.issues.map((issue) => [
                issue.id,
                `"${(issue.title || "").replace(/"/g, '""')}"`,
                issue.type || "",
                issue.priority || "",
                issue.status || "",
                `"${(issue.reporter?.name || "Unknown").replace(/"/g, '""')}"`,
                `"${(issue.assignee?.name || "Unassigned").replace(/"/g, '""')}"`,
                new Date(issue.createdAt).toISOString(),
            ]);
            const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
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
                description="Manage Discord integration, staff permissions, appearance, and project data."
                icon={<Settings2 className="h-4 w-4" />}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
                <nav className="space-y-0.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
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
                                    {isSavingForums && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {isSavingForums ? "Saving..." : "Save Discord forums"}
                                </Button>
                            </CardBody>
                        </Card>
                    )}

                    {activeTab === "permissions" && canManagePermissions && (
                        <Card>
                            <CardHeader>
                                <div className="space-y-1">
                                    <CardTitle>Staff role permissions</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Define staff-panel roles here. Assign these roles to members from the Members page.
                                    </p>
                                </div>
                            </CardHeader>
                            <CardBody className="space-y-4">
                                <form action={createStaffRoleAction} className="flex flex-wrap gap-2">
                                    <Input
                                        name="name"
                                        placeholder="New role name"
                                        className="h-8 w-44 text-xs"
                                        maxLength={60}
                                        required
                                    />
                                    <select
                                        name="baseRole"
                                        defaultValue="Member"
                                        className="h-8 rounded-md border border-input bg-elevated px-2 text-xs text-foreground focus-ring"
                                    >
                                        {PROJECT_ROLES.map((role) => (
                                            <option key={role} value={role}>
                                                {role}
                                            </option>
                                        ))}
                                    </select>
                                    <Button type="submit" size="sm">
                                        Create role
                                    </Button>
                                </form>

                                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                    {staffRoles.map((role) => {
                                        const rolePermissions = normalizeStaffPanelPermissions(role.permissions);
                                        return (
                                            <div key={role.id} className="rounded-md border border-border bg-surface-2 p-3">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-semibold text-foreground">
                                                                {role.name}
                                                            </h3>
                                                            {role.isSystem && <Badge tone="neutral">System</Badge>}
                                                        </div>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Base app role: {role.baseRole}
                                                        </p>
                                                    </div>
                                                    {!role.isSystem && (
                                                        <form action={deleteStaffRoleAction}>
                                                            <input type="hidden" name="roleId" value={role.id} />
                                                            <Button type="submit" size="xs" variant="danger">
                                                                Delete
                                                            </Button>
                                                        </form>
                                                    )}
                                                </div>

                                                {!role.isSystem && (
                                                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                                                        <form action={renameStaffRoleAction} className="flex gap-2">
                                                            <input type="hidden" name="roleId" value={role.id} />
                                                            <Input
                                                                name="name"
                                                                defaultValue={role.name}
                                                                className="h-8 text-xs"
                                                                maxLength={60}
                                                                required
                                                            />
                                                            <Button type="submit" size="sm" variant="outline">
                                                                Rename
                                                            </Button>
                                                        </form>
                                                        <form action={updateStaffRoleBaseRoleAction} className="flex gap-2">
                                                            <input type="hidden" name="roleId" value={role.id} />
                                                            <select
                                                                name="baseRole"
                                                                defaultValue={role.baseRole}
                                                                className="h-8 rounded-md border border-input bg-elevated px-2 text-xs text-foreground focus-ring"
                                                            >
                                                                {PROJECT_ROLES.map((projectRole) => (
                                                                    <option key={projectRole} value={projectRole}>
                                                                        {projectRole}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <Button type="submit" size="sm" variant="outline">
                                                                Save
                                                            </Button>
                                                        </form>
                                                    </div>
                                                )}

                                                <div className="mt-3">
                                                    <PermissionToggleButton
                                                        roleId={role.id}
                                                        permissions={rolePermissions}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
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
                                                <span className={cn("h-7 w-7 rounded-full border", swatch)} />
                                                <span className="font-medium capitalize text-foreground">{opt}</span>
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
                                        Includes issues, users, and notes. The generation process may take a moment
                                        depending on project size.
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
                                            {isExporting === "csv" ? "Exporting..." : "Export CSV"}
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
                                            {isExporting === "json" ? "Exporting..." : "Export JSON"}
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
                                        Once you delete project data there is no going back. All issues, notes, links,
                                        and notifications will be cleared.
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
                                        {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        {isDeleting ? "Deleting..." : "Delete all project data"}
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
