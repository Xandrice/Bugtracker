import { syncDiscordIssueStatus } from "./discord-chat";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canAssignIssues, type PermissionContext } from "@/lib/permissions";
import { pgTable } from "@/lib/pg-schema";
import { issueFieldChanges, validateIssueFields } from "./issue-validation";
import { rankWhenEnteringBacklog } from "./issue-backlog";
import { recordActivity } from "./activity";
import { getAppBaseUrl, sendDiscordDM } from "./discord";
import { formatIssueRef } from "./issue-ids";
import { assigneeNames, assigneeUsers, issueAssigneeInclude } from "./issue-assignees";

export type IssueActor = { userId: string; permissions: PermissionContext | null; name?: string | null };

/** One issue and its audit entries commit together. External notifications happen afterwards. */
export async function mutateIssue(issueId: string, input: Record<string, unknown>, actor: IssueActor) {
  const { data, fieldErrors } = validateIssueFields(input);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  if (!Object.keys(data).length) return { error: "No updates provided." };
  if ("assigneeIds" in data && !canAssignIssues(actor.permissions)) return { error: "You do not have permission to assign issues." };
  try {
    const committed = await db.$transaction(async (tx) => {
      // Serialize writes to the same issue so audit old values reflect the actual preceding state.
      await tx.$queryRaw`SELECT id FROM ${pgTable("Issue")} WHERE id = ${issueId} FOR UPDATE`;
      const previous = await tx.issue.findUnique({ where: { id: issueId }, include: { assignees: issueAssigneeInclude } });
      if (!previous) return null;
      const previousUsers = assigneeUsers(previous.assignees);
      const previousIds = previousUsers.map(user => user.id).sort();
      let nextUsers = previousUsers;
      if (data.assigneeIds) {
        nextUsers = await tx.user.findMany({ where: { id: { in: data.assigneeIds } }, select: { id: true, name: true, image: true }, orderBy: { id: "asc" } });
        if (nextUsers.length !== data.assigneeIds.length) throw new Error("ASSIGNEE_NOT_FOUND");
      }
      const changes = issueFieldChanges({ ...previous, assigneeIds: previousIds }, data);
      const { assigneeIds, ...fields } = data;
      const update: Prisma.IssueUncheckedUpdateInput = { ...fields };
      const assignmentChanged = changes.some(change => change.field === "assigneeIds");
      if (assignmentChanged && assigneeIds) {
        update.assigneeId = assigneeIds[0] ?? null;
        update.assignees = { deleteMany: {}, create: assigneeIds.map(userId => ({ userId })) };
      }
      if (data.status === "BACKLOG" && previous.status !== "BACKLOG") update.backlogRank = await rankWhenEnteringBacklog(tx, previous.backlogRank);
      const issue = changes.length ? await tx.issue.update({ where: { id: issueId }, data: update, include: { assignees: issueAssigneeInclude } }) : previous;
      for (const change of changes) {
        await tx.issueActivity.create({ data: {
          issueId, actorId: actor.userId,
          action: change.field === "status" ? "STATUS_CHANGE" : change.field === "assigneeIds" ? "ASSIGNEE_CHANGE" : "FIELD_CHANGE",
          field: change.field === "assigneeIds" ? "assignees" : change.field,
          oldValue: change.field === "assigneeIds" ? assigneeNames(previousUsers) || null : change.oldValue,
          newValue: change.field === "assigneeIds" ? assigneeNames(nextUsers) || null : change.newValue,
        } });
      }
      return { issue, changes, addedAssigneeIds: assignmentChanged ? (assigneeIds || []).filter(id => !previousIds.includes(id)) : [] };
    });
    if (!committed) return { error: "Issue not found." };
    for (const change of committed.changes) {
      try {
        if (change.field === "status") await syncDiscordIssueStatus(issueId, change.newValue || "OPEN", actor.name || "Staff");
        if (change.field === "status") await recordActivity({ issueId, actorId: actor.userId, actorName: actor.name, action: "STATUS_CHANGE", ...change, notifyStatusChange: true, activityAlreadyRecorded: true });
      } catch (error) { console.error("Issue saved; notification delivery failed", error); }
    }
    for (const userId of committed.addedAssigneeIds) {
      if (userId === actor.userId) continue;
      try {
        const ref = formatIssueRef(committed.issue.publicKey, issueId);
        await db.notification.create({ data: { userId, actorId: actor.userId, issueId, type: "ASSIGNED", title: `${actor.name || "Someone"} assigned you ${ref}`, body: committed.issue.title, link: `/issues/${ref}` } });
        const account = await db.account.findFirst({ where: { userId, provider: "discord" }, select: { providerAccountId: true } });
        if (account) await sendDiscordDM(account.providerAccountId, `You were assigned **${ref}**: ${committed.issue.title}\n${getAppBaseUrl()}/issues/${ref}`);
      } catch (error) { console.error("Issue saved; notification delivery failed", error); }
    }
    return { issue: committed.issue };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "This Discord post is already linked to another issue.", fieldErrors: { discordPostId: "Choose a post that is not already linked." } };
    if (error instanceof Error && error.message === "ASSIGNEE_NOT_FOUND") return { error: "An assignee no longer exists.", fieldErrors: { assigneeIds: "Refresh and choose valid assignees." } };
    console.error("Issue transaction failed", error);
    return { error: "Could not save this issue. Refresh and try again." };
  }
}
