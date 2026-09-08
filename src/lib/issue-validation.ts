export const ISSUE_ENUMS = {
  status: ["BACKLOG", "OPEN", "IN_PROGRESS", "REVIEW", "DONE"],
  type: ["BUG", "FEATURE", "TASK"],
  priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  severity: ["MINOR", "MAJOR", "CRITICAL", "BLOCKER"],
} as const;

export type IssueFormResult = { error?: string; fieldErrors?: Record<string, string> };
export type IssueFields = {
  title?: string; description?: string | null; status?: string; type?: string;
  priority?: string; severity?: string; dueDate?: Date | null; storyPoints?: number | null;
  tags?: string | null; environment?: string | null; resourceName?: string | null;
  serverVersion?: string | null; reproductionSteps?: string | null; expectedBehavior?: string | null;
  label?: string | null; assigneeId?: string | null; discordThreadId?: string | null; discordChannelId?: string | null;
};
const textFields = ["description", "tags", "environment", "resourceName", "serverVersion", "reproductionSteps", "expectedBehavior", "label", "assigneeId", "discordThreadId", "discordChannelId"] as const;

export function validateIssueFields(input: Record<string, unknown>, create = false): {
  data: IssueFields; fieldErrors: Record<string, string>;
} {
  const data: IssueFields = {};
  const fieldErrors: Record<string, string> = {};
  if (create || "title" in input) {
    if (typeof input.title !== "string" || !input.title.trim()) fieldErrors.title = "Enter a title.";
    else data.title = input.title.trim();
  }
  for (const field of Object.keys(ISSUE_ENUMS) as Array<keyof typeof ISSUE_ENUMS>) {
    if (!(field in input)) continue;
    const value = input[field];
    if (typeof value !== "string" || !(ISSUE_ENUMS[field] as readonly string[]).includes(value)) fieldErrors[field] = `Choose a valid ${field}.`;
    else data[field] = value;
  }
  for (const field of textFields) {
    if (!(field in input)) continue;
    const value = input[field];
    if (value !== null && typeof value !== "string") fieldErrors[field] = "Enter text.";
    else data[field] = typeof value === "string" && value.trim() ? value : null;
  }
  if ("dueDate" in input) {
    const value = input.dueDate;
    if (value === "" || value === null) data.dueDate = null;
    else if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fieldErrors.dueDate = "Enter a valid date.";
    else {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fieldErrors.dueDate = "Enter a real calendar date.";
      else data.dueDate = date;
    }
  }
  if ("storyPoints" in input) {
    const value = input.storyPoints;
    if (value === "" || value === null) data.storyPoints = null;
    else if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value)) || Number(value) > 2147483647) fieldErrors.storyPoints = "Enter a whole number from 0 to 2147483647.";
    else data.storyPoints = Number(value);
  }
  return { data, fieldErrors };
}

export function issueFieldChanges(previous: Record<string, unknown>, data: IssueFields) {
  const text = (value: unknown) => value instanceof Date ? value.toISOString() : value == null ? null : String(value);
  return Object.entries(data).flatMap(([field, value]) => {
    const oldValue = text(previous[field]);
    const newValue = text(value);
    return oldValue === newValue ? [] : [{ field, oldValue, newValue }];
  });
}
