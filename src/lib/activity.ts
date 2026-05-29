import { db } from "@/lib/db";
import { getAppBaseUrl, sendDiscordDM } from "@/lib/discord";
import { formatIssueRef } from "@/lib/issue-ids";

async function getUserDiscordId(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, provider: "discord" },
    select: { providerAccountId: true },
  });
  return account?.providerAccountId || null;
}

async function notifyUser(input: {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  issueId?: string | null;
  discordMessage?: string | null;
}) {
  const isSelf = !!input.actorId && input.actorId === input.userId;
  if (isSelf) return;

  try {
    await (db as any).notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId || null,
        type: input.type,
        title: input.title,
        body: input.body || null,
        link: input.link || null,
        issueId: input.issueId || null,
      },
    });
  } catch (err) {
    console.error("Failed to create notification", err);
  }

  if (input.discordMessage) {
    const discordId = await getUserDiscordId(input.userId);
    if (discordId) {
      await sendDiscordDM(discordId, input.discordMessage);
    }
  }
}

export async function recordActivity(input: {
  issueId: string;
  actorId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  actorName?: string | null;
  notifyStatusChange?: boolean;
}) {
  try {
    await (db as any).issueActivity.create({
      data: {
        issueId: input.issueId,
        actorId: input.actorId,
        action: input.action,
        field: input.field || null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to record activity", err);
  }

  if (!input.notifyStatusChange || input.field !== "status") return;

  const issue = await db.issue.findUnique({
    where: { id: input.issueId },
    select: {
      title: true,
      publicKey: true,
      assigneeId: true,
      reporterId: true,
    },
  });
  if (!issue) return;

  const issueRef = formatIssueRef(issue.publicKey, input.issueId);
  const actorName = input.actorName || "Someone";
  const title = `${actorName} changed status on ${issueRef}`;
  const body = `${input.oldValue ?? "—"} → ${input.newValue ?? "—"}`;
  const link = `/issues/${issueRef}`;
  const issueUrl = `${getAppBaseUrl()}${link}`;
  const dmBody = `**${actorName}** changed status on **${issueRef}**: ${body}\n${issueUrl}`;

  const recipients = new Set<string>();
  if (issue.assigneeId) recipients.add(issue.assigneeId);
  if (issue.reporterId) recipients.add(issue.reporterId);

  for (const userId of recipients) {
    await notifyUser({
      userId,
      actorId: input.actorId,
      type: "STATUS_CHANGE",
      title,
      body,
      link,
      issueId: input.issueId,
      discordMessage: dmBody,
    });
  }
}

export function formatActivityLabel(activity: {
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}): string {
  const field = activity.field;
  const oldVal = activity.oldValue ?? "—";
  const newVal = activity.newValue ?? "—";

  switch (activity.action) {
    case "CREATED":
      return "Created this issue";
    case "STATUS_CHANGE":
      return `Changed status from ${oldVal} to ${newVal}`;
    case "ASSIGNEE_CHANGE":
      return newVal === "—" || !activity.newValue
        ? "Unassigned this issue"
        : `Assigned to ${newVal}`;
    case "FIELD_CHANGE":
      return field
        ? `Changed ${field} from ${oldVal} to ${newVal}`
        : `Updated ${newVal}`;
    case "LINK_ADDED":
      return `Linked issue ${newVal}`;
    case "LINK_REMOVED":
      return `Removed link to ${oldVal}`;
    case "SUBTASK_ADDED":
      return `Added subtask ${newVal}`;
    case "SUBTASK_REMOVED":
      return `Removed subtask ${oldVal}`;
    default:
      return activity.action.replace(/_/g, " ").toLowerCase();
  }
}
