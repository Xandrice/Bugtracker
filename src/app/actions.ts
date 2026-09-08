"use server";

import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { mutateIssue } from "@/lib/issue-mutations";
import { validateIssueFields, type IssueFormResult } from "@/lib/issue-validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppBaseUrl, sendDiscordChannelMessage, sendDiscordDM } from "@/lib/discord";
import { getStaffUsers } from "@/lib/staff";
import { formatIssueRef } from "@/lib/issue-ids";
import { generateIssuePublicKey } from "@/lib/issue-key";
import { normalizeNoteThreadCategory } from "@/lib/note-categories";
import {
    canAssignIssues,
    canDeleteAllData,
    canDeleteIssues,
    canExportData,
    canManageMembers,
    canManageNote,
    getPermissionContext,
    PROJECT_ROLES,
    requirePermission,
} from "@/lib/permissions";
import {
    EMPTY_STAFF_PANEL_PERMISSIONS,
    getStaffPermissionValue,
    mergeStaffPanelPermissions,
    normalizeStaffPanelPermissions,
    setStaffPermissionValue,
    type StaffPermissionKey,
} from "@/lib/staff-permissions";
import { recordActivity } from "@/lib/activity";
import { getIssueWatcherUserIds, uniqueUserIds } from "@/lib/issue-watchers";
import { discordSignInUrl } from "@/lib/auth-urls";
import { syncProjectMemberProfileByDiscordId } from "@/lib/member-profiles";
import { nextBacklogRank, placeBacklogIssue, rankWhenEnteringBacklog } from "@/lib/issue-backlog";

const ALLOWED_STATUS = ["BACKLOG", "OPEN", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const ALLOWED_PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ALLOWED_TYPE = ["BUG", "FEATURE", "TASK"] as const;
const ALLOWED_SEVERITY = ["MINOR", "MAJOR", "CRITICAL", "BLOCKER"] as const;
const ALLOWED_LINK_TYPE = ["BLOCKS", "BLOCKED_BY", "RELATES_TO", "DUPLICATES"] as const;
type LinkType = (typeof ALLOWED_LINK_TYPE)[number];
const LINK_TYPE_INVERSE: Record<LinkType, LinkType> = {
    BLOCKS: "BLOCKED_BY",
    BLOCKED_BY: "BLOCKS",
    RELATES_TO: "RELATES_TO",
    DUPLICATES: "DUPLICATES",
};

function redirectToSignIn(callbackUrl = "/"): never {
    redirect(discordSignInUrl(callbackUrl));
}

async function assertSignedIn() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return session;
}

async function getActorContext() {
    const session = await assertSignedIn();
    if (!session?.user?.id) return null;
    const userId = session.user.id;
    const permissions = await getPermissionContext(userId);
    return { session, permissions, userId };
}

async function getIssuePublicRef(issueId: string) {
    const issue = await db.issue.findUnique({
        where: { id: issueId },
        select: { publicKey: true },
    });
    return formatIssueRef(issue?.publicKey, issueId);
}

async function redirectToIssue(issueId: string): Promise<never> {
    const issueRef = await getIssuePublicRef(issueId);
    redirect(`/issues/${issueRef}`);
}

function revalidateIssuePaths(issueId: string) {
    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/issues/me");
    revalidatePath("/issues/backlog");
    revalidatePath("/boards/triage");
    revalidatePath("/boards/main");
    revalidatePath(`/issues/${issueId}`);
}

function revalidatePermissionPaths() {
    revalidatePath("/members");
    revalidatePath("/staff-tools");
    revalidatePath("/staff-tools/players");
    revalidatePath("/staff-tools/vehicles");
    revalidatePath("/staff-tools/economy");
}

async function ensureCanManageMembers() {
    const actor = await getActorContext();
    if (!actor) redirectToSignIn();

    const denied = requirePermission(canManageMembers(actor.permissions));
    if (denied) throw new Error(denied.error);

    return actor;
}

function parseStaffPermissionKey(value: FormDataEntryValue | null): StaffPermissionKey {
    const key = String(value || "").trim() as StaffPermissionKey;
    if (
        key !== "players.view" &&
        key !== "players.manage" &&
        key !== "vehicles.view" &&
        key !== "vehicles.manage" &&
        key !== "economy.view" &&
        key !== "schema.refresh"
    ) {
        throw new Error("Invalid staff permission.");
    }
    return key;
}

function parseProjectRole(value: FormDataEntryValue | null): string {
    const role = String(value || "Member").trim();
    return PROJECT_ROLES.includes(role as (typeof PROJECT_ROLES)[number]) ? role : "Member";
}

function parseDiscordPostInput(value: string | null): { postId: string | null; postLink: string | null } {
    const raw = (value || "").trim();
    if (!raw) return { postId: null, postLink: null };

    const match = raw.match(/^https?:\/\/discord\.com\/channels\/([0-9]+)\/([0-9]+)(?:\/[0-9]+)?/i);
    if (match) {
        return {
            postId: match[2],
            postLink: `https://discord.com/channels/${match[1]}/${match[2]}`,
        };
    }

    const idMatch = raw.match(/^\d+$/);
    if (!idMatch) return { postId: null, postLink: null };

    const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
    const postLink = guildId ? `https://discord.com/channels/${guildId}/${raw}` : null;
    return { postId: raw, postLink };
}

async function getUserDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}

/**
 * Creates an in-app notification AND (optionally) sends a Discord DM to the
 * recipient. Self-actions are skipped unless `notifySelf` is set — handy for
 * "I @-mentioned myself" cases where the user clearly opted in.
 */
async function notifyUser(input: {
    userId: string;
    actorId?: string | null;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    issueId?: string | null;
    discordMessage?: string | null;
    notifySelf?: boolean;
}) {
    const isSelf = !!input.actorId && input.actorId === input.userId;
    if (isSelf && !input.notifySelf) return;

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

async function notifyMentionedUsers(input: {
    content: string;
    senderName: string;
    senderId?: string;
    targetLink: string;
    issueId?: string | null;
    pageTitle?: string;
}) {
    const mentions = input.content.match(/@([A-Za-z0-9_.-]+)/g);
    if (!mentions || mentions.length === 0) return;

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const mentionTokens = Array.from(
        new Set(
            mentions
                .map((m) => normalize(m.slice(1).trim()))
                .filter(Boolean)
        )
    );

    const staffUsers = await getStaffUsers();
    const targets = staffUsers.filter((u) => {
        if (!u.name) return false;
        const normalizedName = normalize(u.name);
        return mentionTokens.some((token) => normalizedName.includes(token));
    });

    const snippet = input.content.length > 180
        ? input.content.slice(0, 177) + "…"
        : input.content;

    const baseUrl = getAppBaseUrl();
    const fullLink = input.targetLink.startsWith("http")
        ? input.targetLink
        : `${baseUrl}${input.targetLink}`;

    for (const target of targets) {
        const dmBody = `You were tagged in BugTracker by **${input.senderName}**: \n${fullLink}\n\n> ${input.content.replace(/\n/g, "\n> ")}`;

        await notifyUser({
            userId: target.id,
            actorId: input.senderId || null,
            type: "MENTION",
            title: `${input.senderName} mentioned you${input.pageTitle ? ` in ${input.pageTitle}` : ""}`,
            body: snippet,
            link: input.targetLink.replace(baseUrl, "") || input.targetLink,
            issueId: input.issueId || null,
            discordMessage: target.discordId ? dmBody : null,
            // Self-mentions ARE intentional — typing @yourself counts as opting in.
            notifySelf: true,
        });
    }
}

export async function createIssue(formData: FormData): Promise<IssueFormResult | void> {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();
    const reporterId = session.user.id;
    const input = Object.fromEntries(formData.entries());
    const validation = validateIssueFields({ type: "BUG", priority: "MEDIUM", severity: "MINOR", ...input }, true);
    if (Object.keys(validation.fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors: validation.fieldErrors };
    for (const [field, value] of Object.entries(input)) {
        if (typeof value !== "string") return { error: "Enter text values.", fieldErrors: { [field]: "Enter text." } };
    }
    formData.set("title", validation.data.title!);
    for (const [field, value] of Object.entries({ type: "BUG", priority: "MEDIUM", severity: "MINOR" })) if (!formData.has(field)) formData.set(field, value);

    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const type = formData.get("type") as string;
    const priority = formData.get("priority") as string;
    const severity = (formData.get("severity") as string) || "MINOR";
    const environment = formData.get("environment") as string | null;
    const tags = formData.get("tags") as string | null;
    const resourceName = formData.get("resourceName") as string | null;
    const serverVersion = formData.get("serverVersion") as string | null;
    const reproductionSteps = formData.get("reproductionSteps") as string | null;
    const expectedBehavior = formData.get("expectedBehavior") as string | null;
    const dueDateRaw = formData.get("dueDate") as string | null;
    const storyPointsRaw = formData.get("storyPoints") as string | null;
    const label = formData.get("label") as string | null;
    const statusRaw = (formData.get("status") as string | null)?.trim();
    const status =
        statusRaw && (ALLOWED_STATUS as readonly string[]).includes(statusRaw)
            ? statusRaw
            : undefined;
    const discordPostRaw = (formData.get("discordPostId") as string | null)
        ?? (formData.get("discordThreadId") as string | null);
    const { postId: discordPostId, postLink: discordPostLink } = parseDiscordPostInput(discordPostRaw);

    if (!title || !type || !priority) {
        throw new Error("Missing required fields");
    }

    if (discordPostId) {
        const existing = await db.issue.findUnique({
            where: { discordThreadId: discordPostId },
            select: { id: true, publicKey: true },
        });

        if (existing) {
            redirect(`/issues/${formatIssueRef(existing.publicKey, existing.id)}`);
        }
    }

    let issue;
    try {
        let createdIssue = null;
        for (let attempt = 0; attempt < 5 && !createdIssue; attempt += 1) {
            try {
                createdIssue = await db.$transaction(async (tx) => {
                    const backlogRank =
                        status === "BACKLOG" ? await nextBacklogRank(tx) : undefined;
                    const created = await tx.issue.create({
                        data: {
                            publicKey: generateIssuePublicKey(),
                            title,
                            description,
                            type,
                            priority,
                            severity,
                            ...(status ? { status } : {}),
                            environment,
                            tags,
                            resourceName: resourceName || undefined,
                            serverVersion: serverVersion || undefined,
                            reproductionSteps: reproductionSteps || undefined,
                            expectedBehavior: expectedBehavior || undefined,
                            dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
                            storyPoints: storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined,
                            label: label || undefined,
                            discordChannelId: undefined,
                            discordThreadId: discordPostId || undefined,
                            backlogRank,
                            reporter: { connect: { id: reporterId } },
                        },
                    });
                    await tx.issueActivity.create({ data: { issueId: created.id, actorId: reporterId, action: "CREATED" } });
                    return created;
                });
            } catch (error: any) {
                // P2002 on publicKey means collision — retry with a fresh key.
                // P2002 on discordThreadId is a real conflict — rethrow.
                if (error?.code !== "P2002") throw error;
                const conflictTarget = Array.isArray(error?.meta?.target) ? error.meta.target : [];
                if (!conflictTarget.includes("publicKey")) throw error;
            }
        }

        if (!createdIssue) {
            throw new Error("Failed to allocate a unique issue key");
        }
        issue = createdIssue;
    } catch (error: any) {
        if (error?.code === "P2002" && discordPostId) {
            const existing = await db.issue.findUnique({
                where: { discordThreadId: discordPostId },
                select: { id: true, publicKey: true },
            });
            if (existing) {
                redirect(`/issues/${formatIssueRef(existing.publicKey, existing.id)}`);
            }
        }
        console.error("Issue creation failed", error);
        return { error: "Could not create this issue. Your report is preserved; try again." };
    }

    // If a forum post ID is linked, publish an initial traceability message there.
    try { if (discordPostId) {
        const baseUrl = getAppBaseUrl();
        const issueLink = `${baseUrl}/issues/${formatIssueRef(issue.publicKey, issue.id)}`;
        const introMessage = [
            "This has been added to the developer tracker.",
            `Issue: **${issue.title}**`,
            `Type: ${issue.type} | Priority: ${issue.priority}`,
            ...(discordPostLink ? [`Discord Post: ${discordPostLink}`] : []),
            `Track it here: ${issueLink}`,
        ].join("\n");

        const discordMessageId = await sendDiscordChannelMessage(discordPostId, introMessage);
        if (discordMessageId) {
            await db.issue.update({
                where: { id: issue.id },
                data: { discordMessageId },
            });
        }
    }

    } catch (error) { console.error("Issue created; Discord notice failed", error); }

    revalidatePath("/issues");
    revalidatePath("/issues/backlog");
    revalidatePath("/boards/triage");
    revalidatePath("/boards/main");
    revalidatePath("/");

    await redirectToIssue(issue.id);
}

export async function updateIssueStatus(issueId: string, status: string) {
    return updateIssueWorkflow(issueId, { status });
}

export async function updateIssueWorkflow(
    issueId: string,
    updates: Partial<{ type: string; priority: string; severity: string; status: string }>,
    options?: { skipRevalidate?: boolean }
) {
    const actor = await getActorContext();
    if (!actor) return { error: "Unauthorized" };
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) return { error: "Invalid updates." };
    const allowed = Object.fromEntries(Object.entries(updates).filter(([key]) => ["type", "priority", "severity", "status"].includes(key)));
    const result = await mutateIssue(issueId, allowed, { ...actor, name: actor.session.user?.name });
    if (!options?.skipRevalidate) revalidateIssuePaths(issueId);
    return result;
}

export async function reorderBacklogIssue(
    issueId: string,
    afterId: string | null,
    beforeId: string | null
): Promise<{ error?: string } | void> {
    const actor = await getActorContext();
    if (!actor) return { error: "Unauthorized" };

    if (!issueId) return { error: "Missing issue" };

    const result = await placeBacklogIssue({
        issueId,
        afterId: afterId || null,
        beforeId: beforeId || null,
    });
    if (result.error) return result;

    revalidatePath("/issues/backlog");
    revalidatePath("/issues");
    revalidatePath("/boards/main");
}

export async function saveIssueWorkflow(formData: FormData) {
    const issueId = formData.get("issueId") as string | null;
    if (!issueId) throw new Error("Missing issue");

    const type = formData.get("type") as string | null;
    const priority = formData.get("priority") as string | null;
    const severity = formData.get("severity") as string | null;
    const status = formData.get("status") as string | null;

    const result = await updateIssueWorkflow(issueId, {
        ...(type ? { type } : {}),
        ...(priority ? { priority } : {}),
        ...(severity ? { severity } : {}),
        ...(status ? { status } : {}),
    });

    if (result?.error === "Unauthorized") redirectToSignIn();
    if (result?.error) throw new Error(result.error);
    await redirectToIssue(issueId);
}

export async function toggleIssueResolved(formData: FormData) {
    const issueId = formData.get("issueId") as string | null;
    const resolved = formData.get("resolved") as string | null;
    if (!issueId) throw new Error("Missing issue");

    const nextStatus = resolved === "true" ? "DONE" : "OPEN";
    const result = await updateIssueWorkflow(issueId, { status: nextStatus });
    if (result?.error === "Unauthorized") redirectToSignIn();
    if (result?.error) throw new Error(result.error);
    await redirectToIssue(issueId);
}

export async function updateIssue(issueId: string, formData: FormData) {
    const actor = await getActorContext();
    if (!actor) return { error: "Unauthorized" };
    const input = Object.fromEntries(formData.entries());
    if (input.assigneeId === "none") input.assigneeId = "";
    if (formData.has("discordPostId") || formData.has("discordThreadId")) {
        const raw = formData.get("discordPostId") ?? formData.get("discordThreadId");
        if (raw !== null && typeof raw !== "string") return { error: "Enter a Discord post link or ID.", fieldErrors: { discordPostId: "Enter text." } };
        input.discordThreadId = parseDiscordPostInput(raw as string | null).postId || "";
        input.discordChannelId = "";
    }
    const result = await mutateIssue(issueId, input, { ...actor, name: actor.session.user?.name });
    revalidateIssuePaths(issueId);
    return result;
}

export async function saveIssueDetails(formData: FormData): Promise<IssueFormResult | void> {
    const issueId = formData.get("issueId");
    if (typeof issueId !== "string" || !issueId) return { error: "Missing issue." };
    const result = await updateIssue(issueId, formData);
    if (result?.error) return result;
    await redirectToIssue(issueId);
}

export async function updateIssueAssignee(issueId: string, assigneeId: string | null, options?: { skipRevalidate?: boolean }) {
    const actor = await getActorContext();
    if (!actor) return { error: "Unauthorized" };
    const result = await mutateIssue(issueId, { assigneeId }, { ...actor, name: actor.session.user?.name });
    if (!options?.skipRevalidate) revalidateIssuePaths(issueId);
    return result;
}

const MAX_BULK_ISSUE_UPDATES = 100;

export type BulkIssueUpdates = {
    type?: string;
    priority?: string;
    status?: string;
    /** Present to change assignee; `null` unassigns. Omit to leave assignee unchanged. */
    assigneeId?: string | null;
};

/**
 * Apply the same workflow / assignee edits as the single-issue updaters to many
 * rows. Only fields present on `updates` are written. Assignee changes still
 * require `canAssignIssues`. Missing rows are skipped with an error instead of
 * aborting the rest of the batch.
 */
export async function bulkUpdateIssues(issueIds: string[], updates: BulkIssueUpdates) {
    const actor = await getActorContext();
    if (!actor) return { error: "Unauthorized", updated: 0, skipped: [] as { id: string; error: string }[] };
    if (!Array.isArray(issueIds)) return { error: "Invalid issue selection.", updated: 0, skipped: [] };
    const ids = [...new Set(issueIds.filter((id) => typeof id === "string" && id))];
    if (!ids.length || ids.length > MAX_BULK_ISSUE_UPDATES) return { error: "Select between 1 and 100 issues.", updated: 0, skipped: [] };
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) return { error: "Invalid updates.", updated: 0, skipped: [] };
    const input = Object.fromEntries(Object.entries(updates).filter(([key]) => ["type", "priority", "status", "assigneeId"].includes(key)));
    const skipped: { id: string; error: string }[] = [];
    const issues = [];
    for (const id of ids) {
        const result = await mutateIssue(id, input, { ...actor, name: actor.session.user?.name });
        if (result.error) skipped.push({ id, error: result.error });
        else if (result.issue) issues.push(result.issue);
        revalidateIssuePaths(id);
    }
    return { updated: issues.length, skipped, issues };
}

export async function setAssignee(formData: FormData): Promise<void> {
    const issueId = formData.get("issueId") as string;
    const assigneeId = formData.get("assigneeId") as string | null;
    if (!issueId) throw new Error("Missing issue");
    const result = await updateIssueAssignee(issueId, assigneeId === "none" || !assigneeId ? null : assigneeId);
    if (result?.error === "Unauthorized") redirectToSignIn();
    if (result?.error) throw new Error(result.error);
    await redirectToIssue(issueId);
}

export async function toggleIssueWatch(formData: FormData): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const issueId = formData.get("issueId") as string | null;
    const watch = formData.get("watch") as string | null;
    if (!issueId) throw new Error("Missing issue");

    const issue = await db.issue.findUnique({
        where: { id: issueId },
        select: { id: true, publicKey: true },
    });
    if (!issue) throw new Error("Issue not found");

    const userId = session.user.id;
    if (watch === "true") {
        await db.issueWatcher.upsert({
            where: { issueId_userId: { issueId, userId } },
            create: { issueId, userId },
            update: {},
        });
    } else {
        await db.issueWatcher.deleteMany({
            where: { issueId, userId },
        });
    }

    revalidateIssuePaths(issueId);
    revalidatePath(`/issues/${formatIssueRef(issue.publicKey, issue.id)}`);
}

export async function createTeamNote(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const title = formData.get("title") as string | null;
    const content = formData.get("content") as string;
    const issueId = formData.get("issueId") as string | null;
    const threadId = formData.get("threadId") as string | null;
    const threadCategory = normalizeNoteThreadCategory(formData.get("category") as string | null);

    if (!content) throw new Error("Missing content");

    const baseUrl = getAppBaseUrl();
    const senderName = session.user.name || "Someone";

    if (issueId) {
        await db.note.create({
            data: {
                title,
                content,
                authorId: session.user.id,
                issueId,
            }
        });

        const issueRef = await getIssuePublicRef(issueId);
        const [issue, watcherIds] = await Promise.all([
            db.issue.findUnique({
                where: { id: issueId },
                select: { title: true, assigneeId: true },
            }),
            getIssueWatcherUserIds(issueId),
        ]);

        await notifyMentionedUsers({
            content,
            senderName,
            senderId: session.user.id,
            targetLink: `${baseUrl}/issues/${issueRef}`,
            issueId,
            pageTitle: issue?.title,
        });

        // Comments already notify the assignee; explicit watchers share that path.
        // Reporter is not added here (they only get COMMENT if they Watch).
        const commentRecipients = uniqueUserIds(issue?.assigneeId, watcherIds);
        if (commentRecipients.length > 0) {
            const snippet = content.length > 180 ? content.slice(0, 177) + "…" : content;
            const issueUrl = `${baseUrl}/issues/${issueRef}`;
            const dmBody = `**${senderName}** commented on **${issue?.title}**\n${issueUrl}\n\n> ${content.replace(/\n/g, "\n> ")}`;
            for (const userId of commentRecipients) {
                await notifyUser({
                    userId,
                    actorId: session.user.id,
                    type: "COMMENT",
                    title: `${senderName} commented on ${issue?.title}`,
                    body: snippet,
                    link: `/issues/${issueRef}`,
                    issueId,
                    discordMessage: dmBody,
                });
            }
        }

        revalidatePath(`/issues/${issueId}`);
        return;
    }

    if (threadId) {
        const thread = await db.note.findFirst({
            where: {
                id: threadId,
                issueId: null,
                isThread: true,
                parentId: null,
            },
            select: { id: true },
        });
        if (!thread) throw new Error("Thread not found");

        await db.note.create({
            data: {
                content,
                authorId: session.user.id,
                parentId: threadId,
                issueId: null,
                isThread: false,
            }
        });

        const parentThread = await db.note.findUnique({
            where: { id: threadId },
            select: { title: true },
        });

        await notifyMentionedUsers({
            content,
            senderName,
            senderId: session.user.id,
            targetLink: `${baseUrl}/notes/${threadId}`,
            pageTitle: parentThread?.title || undefined,
        });

        revalidatePath(`/notes/${threadId}`);
        revalidatePath("/notes");
        return;
    }

    if (!title || !title.trim()) throw new Error("Missing title");

    const thread = await db.note.create({
        data: {
            title: title.trim(),
            content,
            authorId: session.user.id,
            issueId: null,
            isThread: true,
            category: threadCategory,
        }
    });

    await notifyMentionedUsers({
        content,
        senderName,
        senderId: session.user.id,
        targetLink: `${baseUrl}/notes/${thread.id}`,
        pageTitle: thread.title || undefined,
    });

    revalidatePath("/notes");
    redirect(`/notes/${thread.id}`);
}

export async function updateTeamThread(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const threadId = (formData.get("threadId") as string | null)?.trim();
    const title = (formData.get("title") as string | null)?.trim();
    const content = (formData.get("content") as string | null)?.trim();
    const category = normalizeNoteThreadCategory(formData.get("category") as string | null);

    if (!threadId) throw new Error("Missing threadId");
    if (!title) throw new Error("Missing title");
    if (!content) throw new Error("Missing content");

    const thread = await db.note.findFirst({
        where: {
            id: threadId,
            issueId: null,
            isThread: true,
            parentId: null,
        },
        select: {
            id: true,
            authorId: true,
        },
    });
    if (!thread) throw new Error("Thread not found");

    const permissionContext = await getPermissionContext(session.user.id);
    if (!canManageNote(permissionContext, thread.authorId)) {
        throw new Error("You do not have permission to edit this thread.");
    }

    await db.note.update({
        where: { id: threadId },
        data: {
            title,
            content,
            category,
        },
    });

    revalidatePath("/notes");
    revalidatePath(`/notes/${threadId}`);
    redirect(`/notes/${threadId}`);
}

export async function deleteTeamThread(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const threadId = (formData.get("threadId") as string | null)?.trim();
    if (!threadId) throw new Error("Missing threadId");

    const thread = await db.note.findFirst({
        where: {
            id: threadId,
            issueId: null,
            isThread: true,
            parentId: null,
        },
        select: {
            id: true,
            authorId: true,
        },
    });
    if (!thread) throw new Error("Thread not found");

    const permissionContext = await getPermissionContext(session.user.id);
    if (!canManageNote(permissionContext, thread.authorId)) {
        throw new Error("You do not have permission to delete this thread.");
    }

    await db.note.delete({
        where: { id: threadId },
    });

    revalidatePath("/notes");
    redirect("/notes");
}

export async function deleteTeamReply(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const replyId = (formData.get("replyId") as string | null)?.trim();
    const threadId = (formData.get("threadId") as string | null)?.trim();
    if (!replyId || !threadId) throw new Error("Missing replyId or threadId");

    const reply = await db.note.findFirst({
        where: {
            id: replyId,
            parentId: threadId,
            issueId: null,
        },
        select: {
            id: true,
            authorId: true,
        },
    });
    if (!reply) throw new Error("Reply not found");

    const permissionContext = await getPermissionContext(session.user.id);
    if (!canManageNote(permissionContext, reply.authorId)) {
        throw new Error("You do not have permission to delete this reply.");
    }

    await db.note.delete({
        where: { id: replyId },
    });

    revalidatePath("/notes");
    revalidatePath(`/notes/${threadId}`);
}

export async function addProjectMember(formData: FormData) {
    await ensureCanManageMembers();

    const discordId = formData.get("discordId") as string;
    const role = formData.get("role") as string || "Member";

    if (!discordId) throw new Error("Missing discordId");

    const staffRole = await db.staffRole.findUnique({
        where: { name: parseProjectRole(role) },
        select: { id: true },
    });

    await db.projectMember.create({
        data: {
            discordId,
            role: parseProjectRole(role),
            staffRoleId: staffRole?.id ?? null,
        }
    });

    try {
        await syncProjectMemberProfileByDiscordId(discordId);
    } catch {
        // Profile sync is best-effort when adding a member.
    }

    revalidatePermissionPaths();
}

export async function updateProjectMemberRole(memberId: string, role: string) {
    await ensureCanManageMembers();

    const nextRole = parseProjectRole(role);
    const staffRole = await db.staffRole.findUnique({
        where: { name: nextRole },
        select: { id: true },
    });

    await db.projectMember.update({
        where: { id: memberId },
        data: {
            role: nextRole,
            staffRoleId: staffRole?.id ?? undefined,
        }
    });

    revalidatePermissionPaths();
}

export async function removeProjectMember(memberId: string) {
    await ensureCanManageMembers();

    await db.projectMember.delete({
        where: { id: memberId }
    });

    revalidatePermissionPaths();
}

export async function createStaffRoleAction(formData: FormData) {
    await ensureCanManageMembers();

    const name = String(formData.get("name") || "").trim();
    const baseRole = parseProjectRole(formData.get("baseRole"));
    if (!name) throw new Error("Missing role name.");
    if (name.length > 60) throw new Error("Role name must be 60 characters or fewer.");

    await db.staffRole.create({
        data: {
            name,
            baseRole,
            permissions: EMPTY_STAFF_PANEL_PERMISSIONS,
            isSystem: false,
        },
    });

    revalidatePermissionPaths();
}

export async function renameStaffRoleAction(formData: FormData) {
    await ensureCanManageMembers();

    const roleId = String(formData.get("roleId") || "").trim();
    const name = String(formData.get("name") || "").trim();
    if (!roleId) throw new Error("Missing role id.");
    if (!name) throw new Error("Missing role name.");
    if (name.length > 60) throw new Error("Role name must be 60 characters or fewer.");

    const role = await db.staffRole.findUnique({
        where: { id: roleId },
        select: { isSystem: true },
    });
    if (!role) throw new Error("Role not found.");
    if (role.isSystem) throw new Error("System roles cannot be renamed.");

    await db.staffRole.update({
        where: { id: roleId },
        data: { name },
    });

    revalidatePermissionPaths();
}

export async function updateStaffRoleBaseRoleAction(formData: FormData) {
    await ensureCanManageMembers();

    const roleId = String(formData.get("roleId") || "").trim();
    const baseRole = parseProjectRole(formData.get("baseRole"));
    if (!roleId) throw new Error("Missing role id.");

    await db.staffRole.update({
        where: { id: roleId },
        data: { baseRole },
    });

    await db.projectMember.updateMany({
        where: { staffRoleId: roleId },
        data: { role: baseRole },
    });

    revalidatePermissionPaths();
}

export async function deleteStaffRoleAction(formData: FormData) {
    await ensureCanManageMembers();

    const roleId = String(formData.get("roleId") || "").trim();
    if (!roleId) throw new Error("Missing role id.");

    const role = await db.staffRole.findUnique({
        where: { id: roleId },
        select: {
            isSystem: true,
            _count: { select: { members: true } },
        },
    });
    if (!role) throw new Error("Role not found.");
    if (role.isSystem) throw new Error("System roles cannot be deleted.");
    if (role._count.members > 0) throw new Error("Cannot delete a role assigned to members.");

    await db.staffRole.delete({ where: { id: roleId } });
    revalidatePermissionPaths();
}

export async function toggleStaffRolePermissionAction(formData: FormData) {
    await ensureCanManageMembers();

    const roleId = String(formData.get("roleId") || "").trim();
    const key = parseStaffPermissionKey(formData.get("permissionKey"));
    if (!roleId) throw new Error("Missing role id.");

    const role = await db.staffRole.findUnique({
        where: { id: roleId },
        select: { permissions: true },
    });
    if (!role) throw new Error("Role not found.");

    const current = normalizeStaffPanelPermissions(role.permissions);
    const next = setStaffPermissionValue(current, key, !getStaffPermissionValue(current, key));

    await db.staffRole.update({
        where: { id: roleId },
        data: { permissions: next },
    });

    revalidatePermissionPaths();
}

export async function assignMemberStaffRoleAction(formData: FormData) {
    await ensureCanManageMembers();

    const memberId = String(formData.get("memberId") || "").trim();
    const staffRoleId = String(formData.get("staffRoleId") || "").trim();
    if (!memberId) throw new Error("Missing member id.");
    if (!staffRoleId) throw new Error("Missing staff role id.");

    const staffRole = await db.staffRole.findUnique({
        where: { id: staffRoleId },
        select: { id: true, baseRole: true },
    });
    if (!staffRole) throw new Error("Staff role not found.");

    await db.projectMember.update({
        where: { id: memberId },
        data: {
            staffRoleId: staffRole.id,
            role: parseProjectRole(staffRole.baseRole),
        },
    });

    revalidatePermissionPaths();
}

export async function toggleMemberStaffPermissionOverrideAction(formData: FormData) {
    await ensureCanManageMembers();

    const memberId = String(formData.get("memberId") || "").trim();
    const key = parseStaffPermissionKey(formData.get("permissionKey"));
    if (!memberId) throw new Error("Missing member id.");

    const member = await db.projectMember.findUnique({
        where: { id: memberId },
        select: {
            staffPermissionOverrides: true,
            staffRole: { select: { permissions: true } },
        },
    });
    if (!member) throw new Error("Member not found.");

    const rolePermissions = normalizeStaffPanelPermissions(member.staffRole?.permissions);
    const effectivePermissions = mergeStaffPanelPermissions(
        rolePermissions,
        member.staffPermissionOverrides
    );
    const next = setStaffPermissionValue(
        effectivePermissions,
        key,
        !getStaffPermissionValue(effectivePermissions, key)
    );

    await db.projectMember.update({
        where: { id: memberId },
        data: { staffPermissionOverrides: next },
    });

    revalidatePermissionPaths();
}

export async function clearMemberStaffPermissionOverridesAction(formData: FormData) {
    await ensureCanManageMembers();

    const memberId = String(formData.get("memberId") || "").trim();
    if (!memberId) throw new Error("Missing member id.");

    await db.projectMember.update({
        where: { id: memberId },
        data: { staffPermissionOverrides: Prisma.JsonNull },
    });

    revalidatePermissionPaths();
}

export async function getMentionableUsers() {
    const session = await auth();
    if (!session?.user?.id) return [];
    const staffUsers = await getStaffUsers();
    return staffUsers.map((u) => ({ id: u.id, name: u.name, image: u.image }));
}

export async function updateIssueDiscordPost(formData: FormData) {
    const issueId = formData.get("issueId");
    if (typeof issueId !== "string" || !issueId) throw new Error("Missing issue");
    const result = await updateIssue(issueId, formData);
    if (result.error) throw new Error(result.error);
    await redirectToIssue(issueId);
}

export async function deleteIssue(formData: FormData) {
    const actor = await getActorContext();
    if (!actor) redirectToSignIn();

    const denied = requirePermission(canDeleteIssues(actor.permissions));
    if (denied) throw new Error(denied.error);

    const issueId = formData.get("issueId") as string | null;
    if (!issueId) throw new Error("Missing issue");

    await db.issue.delete({
        where: { id: issueId },
    });

    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/issues/me");
    revalidatePath("/boards/triage");
    revalidatePath("/boards/main");
    revalidatePath(`/issues/${issueId}`);

    redirect("/issues");
}

export async function exportProjectData() {
    const actor = await getActorContext();
    if (!actor) redirectToSignIn();

    const denied = requirePermission(canExportData(actor.permissions));
    if (denied) throw new Error(denied.error);

    const issues = await db.issue.findMany({
        include: {
            reporter: true,
            assignee: true,
            notes: { include: { author: true } }
        }
    });

    const members = await (db as any).projectMember.findMany();

    return { issues, members };
}

const DISCORD_FORUM_SUGGESTIONS_KEY = "discord.forum.suggestions";
const DISCORD_FORUM_BUGS_KEY = "discord.forum.bugs";

export async function getDiscordForumSettings() {
    const suggestions = await (db as any).appSetting.findUnique({
        where: { key: DISCORD_FORUM_SUGGESTIONS_KEY },
        select: { value: true },
    });
    const bugs = await (db as any).appSetting.findUnique({
        where: { key: DISCORD_FORUM_BUGS_KEY },
        select: { value: true },
    });

    return {
        suggestionsForumId: suggestions?.value || "",
        bugsForumId: bugs?.value || "",
    };
}

export async function saveDiscordForumSettings(input: { suggestionsForumId?: string; bugsForumId?: string }) {
    const actor = await getActorContext();
    if (!actor) redirectToSignIn();

    const denied = requirePermission(canExportData(actor.permissions));
    if (denied) throw new Error(denied.error);

    const cleanSuggestions = (input.suggestionsForumId || "").trim();
    const cleanBugs = (input.bugsForumId || "").trim();

    if (cleanSuggestions) {
        await (db as any).appSetting.upsert({
            where: { key: DISCORD_FORUM_SUGGESTIONS_KEY },
            create: { key: DISCORD_FORUM_SUGGESTIONS_KEY, value: cleanSuggestions },
            update: { value: cleanSuggestions },
        });
    } else {
        await (db as any).appSetting.deleteMany({ where: { key: DISCORD_FORUM_SUGGESTIONS_KEY } });
    }

    if (cleanBugs) {
        await (db as any).appSetting.upsert({
            where: { key: DISCORD_FORUM_BUGS_KEY },
            create: { key: DISCORD_FORUM_BUGS_KEY, value: cleanBugs },
            update: { value: cleanBugs },
        });
    } else {
        await (db as any).appSetting.deleteMany({ where: { key: DISCORD_FORUM_BUGS_KEY } });
    }

    revalidatePath("/settings");

    return {
        suggestionsForumId: cleanSuggestions,
        bugsForumId: cleanBugs,
    };
}

// ---------- Issue comments (edit / delete) ----------

export async function updateIssueComment(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const noteId = (formData.get("noteId") as string | null)?.trim();
    const content = (formData.get("content") as string | null)?.trim();
    const issueId = (formData.get("issueId") as string | null)?.trim();
    if (!noteId || !content || !issueId) throw new Error("Missing fields");

    const note = await db.note.findFirst({
        where: { id: noteId, issueId },
        select: { id: true, authorId: true, source: true },
    });
    if (!note) throw new Error("Comment not found");
    if (note.source === "DISCORD") {
        throw new Error("Discord-sourced comments cannot be edited from the tracker.");
    }

    const permissionContext = await getPermissionContext(session.user.id);
    if (!canManageNote(permissionContext, note.authorId)) {
        throw new Error("You do not have permission to edit this comment.");
    }

    await db.note.update({
        where: { id: noteId },
        data: { content },
    });

    revalidatePath(`/issues/${issueId}`);
    await redirectToIssue(issueId);
}

export async function deleteIssueComment(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const noteId = (formData.get("noteId") as string | null)?.trim();
    const issueId = (formData.get("issueId") as string | null)?.trim();
    if (!noteId || !issueId) throw new Error("Missing fields");

    const note = await db.note.findFirst({
        where: { id: noteId, issueId },
        select: { id: true, authorId: true },
    });
    if (!note) throw new Error("Comment not found");

    const permissionContext = await getPermissionContext(session.user.id);
    if (!canManageNote(permissionContext, note.authorId)) {
        throw new Error("You do not have permission to delete this comment.");
    }

    await db.note.delete({ where: { id: noteId } });

    revalidatePath(`/issues/${issueId}`);
    await redirectToIssue(issueId);
}

// ---------- Notifications ----------

export async function getMyNotifications(limit = 20) {
    const session = await auth();
    if (!session?.user?.id) return [];
    return (db as any).notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

export async function getMyUnreadNotificationCount() {
    const session = await auth();
    if (!session?.user?.id) return 0;
    return (db as any).notification.count({
        where: { userId: session.user.id, readAt: null },
    });
}

export async function markNotificationRead(id: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    await (db as any).notification.updateMany({
        where: { id, userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
    });
    revalidatePath("/");
}

export async function markAllNotificationsRead() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    await (db as any).notification.updateMany({
        where: { userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
    });
    revalidatePath("/");
}

// ---------- Subtasks ----------

export async function createSubtask(formData: FormData): Promise<IssueFormResult | void> {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const reporterId = session.user.id;
    const parentIssueId = formData.get("parentIssueId");
    if (typeof parentIssueId !== "string" || !parentIssueId) return { error: "Missing parent." };
    const { data, fieldErrors } = validateIssueFields({ type: "TASK", priority: "MEDIUM", ...Object.fromEntries(formData.entries()) }, true);
    if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
    try {
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                await db.$transaction(async (tx) => {
                    const parent = await tx.issue.findUnique({ where: { id: parentIssueId }, select: { parentIssueId: true } });
                    if (!parent || parent.parentIssueId) throw new Error("INVALID_PARENT");
                    const created = await tx.issue.create({ data: { title: data.title!, type: data.type!, priority: data.priority!, severity: "MINOR", status: "OPEN", publicKey: generateIssuePublicKey(), reporterId: reporterId, parentIssueId } });
                    await tx.issueActivity.createMany({ data: [
                        { issueId: created.id, actorId: reporterId, action: "CREATED" },
                        { issueId: parentIssueId, actorId: reporterId, action: "SUBTASK_ADDED", newValue: formatIssueRef(created.publicKey, created.id) },
                    ] });
                });
                revalidateIssuePaths(parentIssueId);
                return;
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && Array.isArray(error.meta?.target) && error.meta.target.includes("publicKey")) continue;
                throw error;
            }
        }
        return { error: "Could not allocate an issue key. Try again." };
    } catch (error) {
        if (error instanceof Error && error.message === "INVALID_PARENT") return { error: "Choose an existing parent issue. Subtasks cannot have their own subtasks." };
        console.error("Subtask creation failed", error);
        return { error: "Could not create subtask. Your entries are preserved." };
    }
}

export async function unlinkSubtask(formData: FormData) {
    const actor = await getActorContext();
    if (!actor) redirectToSignIn();
    const subtaskId = formData.get("subtaskId") as string | null;
    const parentIssueId = formData.get("parentIssueId") as string | null;
    if (!subtaskId || !parentIssueId) throw new Error("Missing fields");

    const subtask = await db.issue.findUnique({
        where: { id: subtaskId },
        select: { title: true },
    });

    await db.issue.updateMany({
        where: { id: subtaskId, parentIssueId },
        data: { parentIssueId: null },
    });

    await recordActivity({
        issueId: parentIssueId,
        actorId: actor.userId,
        action: "SUBTASK_REMOVED",
        oldValue: subtask?.title || subtaskId,
    });

    revalidateIssuePaths(parentIssueId);
    await redirectToIssue(parentIssueId);
}

// ---------- Issue Links ----------

export async function createIssueLink(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const sourceId = formData.get("sourceId") as string | null;
    const targetRefRaw = (formData.get("targetRef") as string | null)?.trim();
    const type = formData.get("linkType") as string | null;

    if (!sourceId) throw new Error("Missing source");
    if (!targetRefRaw) throw new Error("Provide a target issue reference (the key shown on the issue, e.g. k7m3qp2a)");
    if (!type || !(ALLOWED_LINK_TYPE as readonly string[]).includes(type)) {
        throw new Error("Invalid link type");
    }

    // Resolve target by publicKey first, then fall back to the internal cuid.
    const cleaned = targetRefRaw.replace(/^#/, "").toLowerCase();
    let target = await db.issue.findUnique({
        where: { publicKey: cleaned },
        select: { id: true },
    });
    if (!target) {
        target = await db.issue.findUnique({
            where: { id: targetRefRaw },
            select: { id: true },
        });
    }
    if (!target) throw new Error(`No issue found for "${targetRefRaw}"`);
    if (target.id === sourceId) throw new Error("Cannot link an issue to itself");

    const linkType = type as LinkType;
    const inverse = LINK_TYPE_INVERSE[linkType];

    await db.$transaction([
        (db as any).issueLink.upsert({
            where: { sourceId_targetId_type: { sourceId, targetId: target.id, type: linkType } },
            create: { sourceId, targetId: target.id, type: linkType },
            update: {},
        }),
        (db as any).issueLink.upsert({
            where: { sourceId_targetId_type: { sourceId: target.id, targetId: sourceId, type: inverse } },
            create: { sourceId: target.id, targetId: sourceId, type: inverse },
            update: {},
        }),
    ]);

    const targetRef = formatIssueRef(
        (await db.issue.findUnique({ where: { id: target.id }, select: { publicKey: true } }))?.publicKey,
        target.id
    );

    const actor = await getActorContext();
    if (actor) {
        await recordActivity({
            issueId: sourceId,
            actorId: actor.userId,
            action: "LINK_ADDED",
            newValue: targetRef,
        });
    }

    revalidateIssuePaths(sourceId);
    revalidateIssuePaths(target.id);
    await redirectToIssue(sourceId);
}

export async function deleteIssueLink(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) redirectToSignIn();

    const linkId = formData.get("linkId") as string | null;
    const sourceId = formData.get("sourceId") as string | null;
    if (!linkId || !sourceId) throw new Error("Missing fields");

    const link = await (db as any).issueLink.findUnique({ where: { id: linkId } });
    if (!link) {
        await redirectToIssue(sourceId);
    }

    const inverse = LINK_TYPE_INVERSE[link.type as LinkType];
    const targetRef = formatIssueRef(
        (await db.issue.findUnique({ where: { id: link.targetId }, select: { publicKey: true } }))?.publicKey,
        link.targetId
    );

    await db.$transaction([
        (db as any).issueLink.delete({ where: { id: linkId } }),
        (db as any).issueLink.deleteMany({
            where: {
                sourceId: link.targetId,
                targetId: link.sourceId,
                type: inverse,
            },
        }),
    ]);

    const actor = await getActorContext();
    if (actor) {
        await recordActivity({
            issueId: sourceId,
            actorId: actor.userId,
            action: "LINK_REMOVED",
            oldValue: targetRef,
        });
    }

    revalidateIssuePaths(sourceId);
    revalidateIssuePaths(link.targetId);
    await redirectToIssue(sourceId);
}

export async function deleteAllProjectData() {
    const actor = await getActorContext();
    if (!actor) redirectToSignIn();

    const denied = requirePermission(canDeleteAllData(actor.permissions));
    if (denied) throw new Error(denied.error);

    // Clear all DB relations
    await (db as any).issueActivity.deleteMany({});
    await (db as any).savedView.deleteMany({});
    await (db as any).incidentIssue.deleteMany({});
    await (db as any).incident.deleteMany({});
    await (db as any).releaseIssue.deleteMany({});
    await (db as any).release.deleteMany({});
    await (db as any).playerReportIssue.deleteMany({});
    await (db as any).playerReport.deleteMany({});
    await (db as any).notification.deleteMany({});
    await (db as any).issueLink.deleteMany({});
    await db.note.deleteMany({});
    await db.issue.deleteMany({});
    // Depending on schema, we might not have cascading on all, but Prisma handles normal deleteMany
    // Remove users / project members if necessary? We'll only delete core task data

    revalidatePath("/issues");
    revalidatePath("/boards/main");
    revalidatePath("/boards/triage");
    revalidatePath("/members");
    revalidatePath("/");

    redirect("/");
}
