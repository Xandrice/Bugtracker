import { saveIssueDetails } from "@/app/actions";
import { priorityLabels } from "@/components/views/DataGrid";

type IssueForEdit = {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    severity: string;
    tags: string | null;
    label: string | null;
    dueDate: Date | null;
    storyPoints: number | null;
    resourceName: string | null;
    serverVersion: string | null;
    reproductionSteps: string | null;
    expectedBehavior: string | null;
    environment: string | null;
};

export function EditIssueDetailsForm({ issue }: { issue: IssueForEdit }) {
    const workflowPriority = ["URGENT", "HIGH", "MEDIUM", "LOW"].includes(issue.priority) ? issue.priority : "MEDIUM";
    const workflowSeverity = ["MINOR", "MAJOR", "CRITICAL", "BLOCKER"].includes(issue.severity) ? issue.severity : "MINOR";
    const dueStr = issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : "";

    return (
        <details className="gta-surface p-4 border border-border/80">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Edit title, fields & planning</summary>
            <p className="text-xs text-muted-foreground mt-2 mb-4">
                Status, type, and assignee stay in the sidebar. Use this panel for narrative fields, tags, and scheduling.
            </p>
            <form action={saveIssueDetails} className="space-y-4">
                <input type="hidden" name="issueId" value={issue.id} />
                <div className="space-y-1.5">
                    <label htmlFor="edit-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Title
                    </label>
                    <input
                        id="edit-title"
                        name="title"
                        required
                        defaultValue={issue.title}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="edit-priority" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Priority
                        </label>
                        <select
                            id="edit-priority"
                            name="priority"
                            defaultValue={workflowPriority}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="URGENT">{priorityLabels.URGENT}</option>
                            <option value="HIGH">{priorityLabels.HIGH}</option>
                            <option value="MEDIUM">{priorityLabels.MEDIUM}</option>
                            <option value="LOW">{priorityLabels.LOW}</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="edit-severity" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Severity
                        </label>
                        <select
                            id="edit-severity"
                            name="severity"
                            defaultValue={workflowSeverity}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="MINOR">Minor (1–5 affected)</option>
                            <option value="MAJOR">Major (6–20 affected)</option>
                            <option value="CRITICAL">Critical (21+ affected)</option>
                            <option value="BLOCKER">Blocker (most/all affected)</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="edit-due" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Due date
                        </label>
                        <input
                            id="edit-due"
                            name="dueDate"
                            type="date"
                            defaultValue={dueStr}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="edit-points" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Story points
                        </label>
                        <input
                            id="edit-points"
                            name="storyPoints"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="—"
                            defaultValue={issue.storyPoints ?? ""}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="edit-tags" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Tags
                        </label>
                        <input
                            id="edit-tags"
                            name="tags"
                            defaultValue={issue.tags ?? ""}
                            placeholder="comma separated"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="edit-label" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Label / category
                        </label>
                        <select
                            id="edit-label"
                            name="label"
                            defaultValue={issue.label ?? ""}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">—</option>
                            <option value="SCRIPT">Script</option>
                            <option value="MAP">Map</option>
                            <option value="CAR">Car</option>
                            <option value="CLOTHES">Clothes</option>
                            <option value="OTHER">Other / misc</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="edit-resource" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Resource
                        </label>
                        <input
                            id="edit-resource"
                            name="resourceName"
                            defaultValue={issue.resourceName ?? ""}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="edit-build" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Server / build
                        </label>
                        <input
                            id="edit-build"
                            name="serverVersion"
                            defaultValue={issue.serverVersion ?? ""}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="edit-env" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Environment
                    </label>
                    <input
                        id="edit-env"
                        name="environment"
                        defaultValue={issue.environment ?? ""}
                        placeholder="e.g. live, staging, reproducible on FX 6683"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="edit-desc" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Description
                    </label>
                    <textarea
                        id="edit-desc"
                        name="description"
                        rows={5}
                        defaultValue={issue.description ?? ""}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y min-h-[100px]"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="edit-repro" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Steps to reproduce
                    </label>
                    <textarea
                        id="edit-repro"
                        name="reproductionSteps"
                        rows={4}
                        defaultValue={issue.reproductionSteps ?? ""}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="edit-expected" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Expected behavior
                    </label>
                    <textarea
                        id="edit-expected"
                        name="expectedBehavior"
                        rows={3}
                        defaultValue={issue.expectedBehavior ?? ""}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y"
                    />
                </div>
                <button
                    type="submit"
                    className="text-sm font-medium rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
                >
                    Save details
                </button>
            </form>
        </details>
    );
}
