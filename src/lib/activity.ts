import { db } from "@/lib/db";
import { getAppBaseUrl, sendDiscordDM } from "@/lib/discord";
import { formatIssueRef } from "@/lib/issue-ids";
import { getIssueWatcherUserIds, uniqueUserIds } from "@/lib/issue-watchers";

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
  activityAlreadyRecorded?: boolean;
}) {
  if (!input.activityAlreadyRecorded) try {
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

  const [issue, watcherIds] = await Promise.all([
    db.issue.findUnique({
      where: { id: input.issueId },
      select: {
        title: true,
        publicKey: true,
        assigneeId: true,
        reporterId: true,
      },
    }),
    getIssueWatcherUserIds(input.issueId),
  ]);
  if (!issue) return;

  const issueRef = formatIssueRef(issue.publicKey, input.issueId);
  const actorName = input.actorName || "Someone";
  const title = `${actorName} changed status on ${issueRef}`;
  const body = `${input.oldValue ?? "—"} → ${input.newValue ?? "—"}`;
  const link = `/issues/${issueRef}`;
  const issueUrl = `${getAppBaseUrl()}${link}`;
  const dmBody = `**${actorName}** changed status on **${issueRef}**: ${body}\n${issueUrl}`;

  // Implicit: reporter + assignee. Explicit: IssueWatcher rows.
  const recipients = uniqueUserIds(issue.assigneeId, issue.reporterId, watcherIds);

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

export { formatActivityLabel } from "./activity-labels";
