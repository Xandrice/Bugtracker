import { db } from "@/lib/db";
import { getDiscordChannelMessages } from "@/lib/discord";

type DiscordAuthor = {
    id?: string;
    username?: string;
    global_name?: string;
    discriminator?: string;
    avatar?: string;
    bot?: boolean;
};

function buildDiscordAuthorTag(author: DiscordAuthor) {
    if (author.global_name && author.username) {
        return `${author.global_name} (@${author.username})`;
    }

    if (author.username && author.discriminator && author.discriminator !== "0") {
        return `${author.username}#${author.discriminator}`;
    }

    return author.username || author.global_name || "Discord User";
}

async function getOrCreateDiscordAuthor(author: DiscordAuthor) {
    const discordId = author.id;
    if (!discordId) {
        return null;
    }

    const existingAccount = await db.account.findUnique({
        where: {
            provider_providerAccountId: {
                provider: "discord",
                providerAccountId: discordId,
            },
        },
        include: { user: true },
    });

    const preferredName = author.global_name || author.username || `Discord ${discordId}`;
    const avatarHash = author.avatar as string | undefined;
    const image = avatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png` : null;

    if (existingAccount?.user) {
        await db.user.update({
            where: { id: existingAccount.user.id },
            data: {
                name: preferredName,
                image,
            },
        });
        return existingAccount.user;
    }

    return db.user.create({
        data: {
            name: preferredName,
            image,
            accounts: {
                create: {
                    provider: "discord",
                    providerAccountId: discordId,
                    type: "oauth",
                },
            },
        },
    });
}

export async function syncIssueNotesFromDiscord(issueId: string) {
    const issue = await (db as any).issue.findUnique({
        where: { id: issueId },
        select: {
            id: true,
            discordThreadId: true,
            discordMessageId: true,
        },
    });

    if (!issue?.discordThreadId) {
        return { synced: 0, reason: "no-linked-thread" };
    }

    const messages = await getDiscordChannelMessages(issue.discordThreadId, 100);
    if (!messages) {
        return { synced: 0, reason: "discord-fetch-failed" };
    }

    if (messages.length === 0) {
        return { synced: 0, reason: "no-messages" };
    }

    const filtered = messages.filter((message) => {
        if (!message.id || !message.author || message.author.bot) return false;
        if (issue.discordMessageId && message.id === issue.discordMessageId) return false;
        return true;
    });

    if (filtered.length === 0) {
        return { synced: 0, reason: "no-user-messages" };
    }

    const existingNotes = await (db as any).note.findMany({
        where: {
            issueId: issue.id,
            discordMessageId: {
                in: filtered.map((message) => message.id),
            },
        },
        select: {
            id: true,
            discordMessageId: true,
            createdAt: true,
        },
    });

    const existingByMessageId = new Map<string, { id: string; createdAt: Date }>(
        existingNotes
            .filter((note: { discordMessageId?: string | null }) => !!note.discordMessageId)
            .map((note: { id: string; discordMessageId: string; createdAt: Date }) => [
                note.discordMessageId,
                { id: note.id, createdAt: note.createdAt },
            ])
    );

    for (const message of filtered) {
        if (!message.id || !message.timestamp) continue;
        const existing = existingByMessageId.get(message.id);
        if (!existing) continue;

        const discordTimestamp = new Date(message.timestamp);
        if (Math.abs(existing.createdAt.getTime() - discordTimestamp.getTime()) < 1000) {
            continue;
        }

        await (db as any).note.update({
            where: { id: existing.id },
            data: { createdAt: discordTimestamp },
        });
    }

    const existingMessageIds = new Set(existingByMessageId.keys());

    const unsynced = filtered
        .filter((message) => !existingMessageIds.has(message.id as string))
        .sort((a, b) => {
            const aTs = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTs = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return aTs - bTs;
        });

    let syncedCount = 0;
    for (const message of unsynced) {
        const noteAuthor = await getOrCreateDiscordAuthor(message.author as DiscordAuthor);
        if (!noteAuthor) {
            continue;
        }

        const authorTag = buildDiscordAuthorTag(message.author as DiscordAuthor);
        const guildId = message.guild_id || (process.env.DISCORD_GUILD_ID || "").trim() || null;
        const postLink = guildId && message.channel_id
            ? `https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`
            : null;

        const attachments = Array.isArray(message.attachments) ? message.attachments : [];
        const attachmentLines = attachments
            .map((attachment) => attachment?.url)
            .filter((url): url is string => typeof url === "string" && url.length > 0);

        const noteContentParts = [
            `**Discord - ${authorTag}**`,
            ...(postLink ? [`Post: ${postLink}`] : []),
            message.content?.trim() || "_(no text content)_",
        ];

        if (attachmentLines.length > 0) {
            noteContentParts.push(`Attachments:\n${attachmentLines.join("\n")}`);
        }

        const discordCreatedAt = message.timestamp ? new Date(message.timestamp) : undefined;

        try {
            await (db as any).note.create({
                data: {
                    issueId: issue.id,
                    authorId: noteAuthor.id,
                    content: noteContentParts.join("\n\n"),
                    source: "DISCORD",
                    discordMessageId: message.id,
                    discordAuthorId: message.author?.id,
                    discordAuthorTag: authorTag,
                    ...(discordCreatedAt ? { createdAt: discordCreatedAt } : {}),
                },
            });
            syncedCount += 1;
        } catch (error: any) {
            // Ignore duplicate inserts in race conditions.
            if (error?.code !== "P2002") {
                throw error;
            }
        }
    }

    return { synced: syncedCount, reason: "ok" };
}
