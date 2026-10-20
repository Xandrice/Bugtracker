const LABELS: Record<string, string> = { IN_PROGRESS: "In progress", BACKLOG: "Backlog", OPEN: "Open", REVIEW: "Review", DONE: "Done", LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent", BUG: "Bug", FEATURE: "Feature", TASK: "Task", MINOR: "Minor", MAJOR: "Major", CRITICAL: "Critical", BLOCKER: "Blocker" };
export function activityFieldLabel(field: string | null | undefined) {
  return (field || "issue details").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, value => value.toUpperCase());
}
export function activityValueLabel(value: string | null | undefined, field?: string | null): string {
  if (!value) return "Not set";
  if (field === "dueDate" && Number.isFinite(Date.parse(value))) return new Date(value).toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "medium" });
  return LABELS[value] || value;
}
export function formatActivityLabel(activity: { action: string; field?: string | null; oldValue?: string | null; newValue?: string | null }) {
  const oldValue = activityValueLabel(activity.oldValue, activity.field); const newValue = activityValueLabel(activity.newValue, activity.field);
  switch (activity.action) {
    case "CREATED": return "Created this issue";
    case "STATUS_CHANGE": return `Changed status from ${oldValue} to ${newValue}`;
    case "ASSIGNEE_CHANGE": return !activity.newValue || activity.newValue === "Unassigned" ? "Unassigned this issue" : `Assigned to ${newValue}`;
    case "FIELD_CHANGE": return `Changed ${activityFieldLabel(activity.field).toLowerCase()} from ${oldValue} to ${newValue}`;
    case "LINK_ADDED": return `Linked issue ${newValue}`;
    case "LINK_REMOVED": return `Removed link to ${oldValue}`;
    case "SUBTASK_ADDED": return `Added subtask ${newValue}`;
    case "SUBTASK_REMOVED": return `Removed subtask ${oldValue}`;
    default: return activity.action.replace(/_/g, " ").toLowerCase();
  }
}
