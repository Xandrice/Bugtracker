import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canAssignIssues, type PermissionContext } from "@/lib/permissions";
import { issueFieldChanges, validateIssueFields } from "./issue-validation";
import { rankWhenEnteringBacklog } from "./issue-backlog";
import { recordActivity } from "./activity";
import { getAppBaseUrl, sendDiscordDM } from "./discord";
import { formatIssueRef } from "./issue-ids";

export type IssueActor = { userId: string; permissions: PermissionContext | null; name?: string | null };

/** One issue and its audit entries commit together. External notifications happen afterwards. */
export async function mutateIssue(issueId: string, input: Record<string, unknown>, actor: IssueActor) {
  const { data, fieldErrors } = validateIssueFields(input);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  if (!Object.keys(data).length) return { error: "No updates provided." };
  if ("assigneeId" in data && !canAssignIssues(actor.permissions)) return { error: "You do not have permission to assign issues." };
  try {
    const committed = await db.$transaction(async (tx) => {
      // Serialize writes to the same issue so audit old values reflect the actual preceding state.
      await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${issueId} FOR UPDATE`;
      const previous = await tx.issue.findUnique({ where: { id: issueId }, include: { assignee: { select: { name: true } } } });
      if (!previous) return null;
      let assigneeName = "Unassigned";
      if (data.assigneeId) {
        const assignee = await tx.user.findUnique({ where: { id: data.assigneeId }, select: { name: true } });
        if (!assignee) throw new Error("ASSIGNEE_NOT_FOUND");
        assigneeName = assignee.name || data.assigneeId;
      }
      const changes = issueFieldChanges(previous, data);
      const update: Prisma.IssueUncheckedUpdateInput = { ...data };
      if (data.status === "BACKLOG" && previous.status !== "BACKLOG") update.backlogRank = await rankWhenEnteringBacklog(tx, previous.backlogRank);
      const issue = changes.length ? await tx.issue.update({ where: { id: issueId }, data: update, include: { assignee: { select: { id: true, name: true, image: true } } } }) : previous;
      for (const change of changes) {
        await tx.issueActivity.create({ data: {
          issueId, actorId: actor.userId,
          action: change.field === "status" ? "STATUS_CHANGE" : change.field === "assigneeId" ? "ASSIGNEE_CHANGE" : "FIELD_CHANGE",
          field: change.field === "assigneeId" ? "assignee" : change.field,
          oldValue: change.field === "assigneeId" ? previous.assignee?.name || "Unassigned" : change.oldValue,
          newValue: change.field === "assigneeId" ? assigneeName : change.newValue,
        } });
      }
      return { issue, changes };
    });
    if (!committed) return { error: "Issue not found." };
    for (const change of committed.changes) {
      try {
        if (change.field === "status") await recordActivity({ issueId, actorId: actor.userId, actorName: actor.name, action: "STATUS_CHANGE", ...change, notifyStatusChange: true, activityAlreadyRecorded: true });
        if (change.field === "assigneeId" && change.newValue && change.newValue !== actor.userId) {
          const ref = formatIssueRef(committed.issue.publicKey, issueId);
          await db.notification.create({ data: { userId: change.newValue, actorId: actor.userId, issueId, type: "ASSIGNED", title: `${actor.name || "Someone"} assigned you ${ref}`, body: committed.issue.title, link: `/issues/${ref}` } });
          const account = await db.account.findFirst({ where: { userId: change.newValue, provider: "discord" }, select: { providerAccountId: true } });
          if (account) await sendDiscordDM(account.providerAccountId, `You were assigned **${ref}**: ${committed.issue.title}\n${getAppBaseUrl()}/issues/${ref}`);
        }
      } catch (error) { console.error("Issue saved; notification delivery failed", error); }
    }
    return { issue: committed.issue };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "This Discord post is already linked to another issue.", fieldErrors: { discordPostId: "Choose a post that is not already linked." } };
    if (error instanceof Error && error.message === "ASSIGNEE_NOT_FOUND") return { error: "Assignee no longer exists.", fieldErrors: { assigneeId: "Choose another assignee." } };
    console.error("Issue transaction failed", error);
    return { error: "Could not save this issue. Refresh and try again." };
  }
}
