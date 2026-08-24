import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAppBaseUrl, sendDiscordChannelMessage } from "@/lib/discord";
import { formatIssueRef, generateIssuePublicKey } from "@/lib/issue-ids";
import { recordActivity } from "@/lib/activity";
import { nextBacklogRank } from "@/lib/issue-backlog";

const ALLOWED_STATUS = ["BACKLOG", "OPEN", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const ALLOWED_PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ALLOWED_TYPE = ["BUG", "FEATURE", "TASK"] as const;
const ALLOWED_SEVERITY = ["MINOR", "MAJOR", "CRITICAL", "BLOCKER"] as const;

type CreateIssueInput = {
    title: string;
    discordUserId: string;
    description?: string | null;
    type?: string;
    priority?: string;
    severity?: string;
    status?: string;
    discordThreadId?: string | null;
    discordPostId?: string | null;
    resourceName?: string | null;
    serverVersion?: string | null;
    reproductionSteps?: string | null;
    expectedBehavior?: string | null;
    environment?: string | null;
    tags?: string | null;
    label?: string | null;
    discordUserName?: string | null;
    discordUserAvatar?: string | null;
};

function parseDiscordPostInput(value: string | null | undefined): { postId: string | null; postLink: string | null } {
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

async function getOrCreateUserFromDiscordId(
    discordId: string,
    userName?: string | null,
    userAvatar?: string | null
) {
    const existingAccount = await db.account.findUnique({
        where: {
            provider_providerAccountId: {
                provider: "discord",
                providerAccountId: discordId,
            }
        },
        include: { user: true },
    });

    if (existingAccount?.user) {
        return existingAccount.user;
    }

    const preferredName = userName || `Discord ${discordId}`;
    const avatarHash = userAvatar as string | undefined;
    const image = avatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png` : null;

    return db.user.create({
        data: {
            name: preferredName,
            image,
            accounts: {
                create: {
                    provider: "discord",
                    providerAccountId: discordId,
                    type: "oauth",
                }
            }
        }
    });
}

function revalidateIssuePaths() {
    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/issues/me");
    revalidatePath("/boards/triage");
    revalidatePath("/boards/main");
    revalidatePath("/issues/backlog");
}

export async function POST(req: Request) {
    // Auth check
    const secret = process.env.DISCORD_WEBHOOK_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: "Server configuration error: DISCORD_WEBHOOK_SECRET not set" },
            { status: 500 }
        );
    }

    const headerSecret = req.headers.get("x-discord-webhook-secret");
    if (!headerSecret || headerSecret !== secret) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    let body: Partial<CreateIssueInput>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    // Validate required fields
    const title = body.title?.trim();
    const discordUserId = body.discordUserId?.trim();

    if (!title) {
        return NextResponse.json(
            { error: "Missing required field: title" },
            { status: 400 }
        );
    }

    if (!discordUserId) {
        return NextResponse.json(
            { error: "Missing required field: discordUserId" },
            { status: 400 }
        );
    }

    // Validate enums
    const type = body.type || "BUG";
    const priority = body.priority || "MEDIUM";
    const severity = body.severity || "MINOR";
    const status = body.status || "OPEN";

    if (!(ALLOWED_TYPE as readonly string[]).includes(type)) {
        return NextResponse.json(
            { error: `Invalid type. Must be one of: ${ALLOWED_TYPE.join(", ")}` },
            { status: 400 }
        );
    }

    if (!(ALLOWED_PRIORITY as readonly string[]).includes(priority)) {
        return NextResponse.json(
            { error: `Invalid priority. Must be one of: ${ALLOWED_PRIORITY.join(", ")}` },
            { status: 400 }
        );
    }

    if (!(ALLOWED_SEVERITY as readonly string[]).includes(severity)) {
        return NextResponse.json(
            { error: `Invalid severity. Must be one of: ${ALLOWED_SEVERITY.join(", ")}` },
            { status: 400 }
        );
    }

    if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
        return NextResponse.json(
            { error: `Invalid status. Must be one of: ${ALLOWED_STATUS.join(", ")}` },
            { status: 400 }
        );
    }

    // Parse Discord thread/post ID
    const discordPostRaw = body.discordThreadId || body.discordPostId;
    const { postId: discordPostId, postLink: discordPostLink } = parseDiscordPostInput(discordPostRaw);

    // Check if thread already linked
    if (discordPostId) {
        const existing = await db.issue.findUnique({
            where: { discordThreadId: discordPostId },
            select: { id: true, publicKey: true, title: true },
        });

        if (existing) {
            const baseUrl = getAppBaseUrl();
            const issueRef = formatIssueRef(existing.publicKey, existing.id);
            const url = `${baseUrl}/issues/${issueRef}`;

            return NextResponse.json(
                {
                    id: existing.id,
                    publicKey: existing.publicKey,
                    url,
                    title: existing.title,
                    existing: true,
                },
                { status: 200 }
            );
        }
    }

    // Get or create user from Discord ID
    let reporter;
    try {
        reporter = await getOrCreateUserFromDiscordId(
            discordUserId,
            body.discordUserName,
            body.discordUserAvatar
        );
    } catch (error) {
        console.error("Failed to get or create user from Discord ID", error);
        return NextResponse.json(
            { error: "Failed to resolve Discord user" },
            { status: 500 }
        );
    }

    // Create issue with publicKey collision retry
    let issue;
    try {
        let createdIssue = null;
        for (let attempt = 0; attempt < 5 && !createdIssue; attempt += 1) {
            try {
                createdIssue = await db.$transaction(async (tx) => {
                    const backlogRank =
                        status === "BACKLOG" ? await nextBacklogRank(tx) : undefined;
                    return tx.issue.create({
                        data: {
                            publicKey: generateIssuePublicKey(),
                            title,
                            description: body.description || null,
                            type,
                            priority,
                            severity,
                            status,
                            environment: body.environment || null,
                            tags: body.tags || null,
                            resourceName: body.resourceName || null,
                            serverVersion: body.serverVersion || null,
                            reproductionSteps: body.reproductionSteps || null,
                            expectedBehavior: body.expectedBehavior || null,
                            label: body.label || null,
                            discordChannelId: null,
                            discordThreadId: discordPostId || null,
                            backlogRank,
                            reporter: { connect: { id: reporter.id } },
                        },
                    });
                });
            } catch (error: unknown) {
                // P2002 on publicKey means collision — retry with a fresh key.
                // P2002 on discordThreadId is a real conflict — rethrow.
                const err = error as { code?: string; meta?: { target?: string[] } };
                if (err?.code !== "P2002") throw error;
                const conflictTarget = Array.isArray(err?.meta?.target) ? err.meta.target : [];
                if (!conflictTarget.includes("publicKey")) throw error;
            }
        }

        if (!createdIssue) {
            return NextResponse.json(
                { error: "Failed to allocate a unique issue key" },
                { status: 500 }
            );
        }
        issue = createdIssue;
    } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === "P2002" && discordPostId) {
            const existing = await db.issue.findUnique({
                where: { discordThreadId: discordPostId },
                select: { id: true, publicKey: true, title: true },
            });
            if (existing) {
                const baseUrl = getAppBaseUrl();
                const issueRef = formatIssueRef(existing.publicKey, existing.id);
                const url = `${baseUrl}/issues/${issueRef}`;

                return NextResponse.json(
                    {
                        id: existing.id,
                        publicKey: existing.publicKey,
                        url,
                        title: existing.title,
                        existing: true,
                    },
                    { status: 200 }
                );
            }
        }
        console.error("Failed to create issue", error);
        return NextResponse.json(
            { error: "Failed to create issue" },
            { status: 500 }
        );
    }

    // If a forum post ID is linked, publish an initial traceability message there.
    if (discordPostId) {
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

    revalidateIssuePaths();

    await recordActivity({
        issueId: issue.id,
        actorId: reporter.id,
        action: "CREATED",
    });

    const baseUrl = getAppBaseUrl();
    const issueRef = formatIssueRef(issue.publicKey, issue.id);
    const url = `${baseUrl}/issues/${issueRef}`;

    return NextResponse.json(
        {
            id: issue.id,
            publicKey: issue.publicKey,
            url,
            title: issue.title,
            existing: false,
        },
        { status: 201 }
    );
}
