import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

type InboundEvent = {
    type: string;
    data: Record<string, unknown>;
};

type DiscordAuthor = {
    id?: string;
    username?: string;
    global_name?: string;
    discriminator?: string;
    avatar?: string;
    bot?: boolean;
};

type DiscordMessageData = {
    id?: string;
    channel_id?: string;
    parent_id?: string;
    content?: string;
    author?: DiscordAuthor;
    attachments?: Array<{ url?: string }>;
};

type DiscordThreadUpdateData = {
    id?: string;
    archived?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hexToUint8Array(hex: string) {
    const cleanHex = hex.trim();
    if (!/^[0-9a-fA-F]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
        return null;
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
    }

    return bytes;
}

function verifyDiscordRequest(rawBody: string, signature: string, timestamp: string, publicKey: string) {
    const message = new TextEncoder().encode(timestamp + rawBody);
    const signatureBytes = hexToUint8Array(signature);
    const publicKeyBytes = hexToUint8Array(publicKey);

    if (!signatureBytes || !publicKeyBytes) {
        return false;
    }

    return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
}

function parseEvent(payload: unknown): InboundEvent | null {
    if (!isRecord(payload)) {
        return null;
    }

    if (typeof payload.t === "string" && isRecord(payload.d)) {
        return { type: payload.t.toUpperCase(), data: payload.d };
    }

    if (typeof payload.type === "string" && isRecord(payload.data)) {
        return { type: payload.type.toUpperCase(), data: payload.data };
    }

    if (typeof payload.event === "string" && isRecord(payload.data)) {
        return { type: payload.event.toUpperCase(), data: payload.data };
    }

    // Relay fallback: event payload already flattened as MESSAGE_CREATE shape.
    if (typeof payload.channel_id === "string" && isRecord(payload.author) && typeof payload.id === "string") {
        return { type: "MESSAGE_CREATE", data: payload };
    }

    // Relay fallback: event payload already flattened as THREAD_UPDATE shape.
    if (typeof payload.id === "string" && typeof payload.archived === "boolean") {
        return { type: "THREAD_UPDATE", data: payload };
    }

    return null;
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
            }
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
            }
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
                }
            }
        }
    });
}

function revalidateIssue(issueId: string) {
    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/issues/me");
    revalidatePath("/boards/triage");
    revalidatePath("/boards/main");
    revalidatePath(`/issues/${issueId}`);
}

async function resolveIssueForMessageEvent(data: DiscordMessageData) {
    const channelId = data.channel_id;

    if (!channelId) {
        return null;
    }

    return (db as any).issue.findFirst({
        where: {
            discordThreadId: channelId,
        },
        select: { id: true },
    });
}

function buildDiscordAuthorTag(author: DiscordAuthor) {
    if (author.global_name && author.username) {
        return `${author.global_name} (@${author.username})`;
    }

    if (author.username && author.discriminator && author.discriminator !== "0") {
        return `${author.username}#${author.discriminator}`;
    }

    return author.username || author.global_name || "Discord User";
}

async function handleMessageCreate(data: DiscordMessageData) {
    const messageId = data.id;
    const author = data.author;
    const content = data.content?.trim() || "";

    if (!messageId || !author || author.bot) {
        return;
    }

    const issue = await resolveIssueForMessageEvent(data);
    if (!issue) {
        return;
    }

    const noteAuthor = await getOrCreateDiscordAuthor(author);
    if (!noteAuthor) {
        return;
    }

    const authorTag = buildDiscordAuthorTag(author);
    const guildId = typeof (data as Record<string, unknown>).guild_id === "string"
        ? ((data as Record<string, unknown>).guild_id as string)
        : null;
    const postLink = guildId ? `https://discord.com/channels/${guildId}/${data.channel_id}` : null;
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    const attachmentLines = attachments
        .map((attachment) => attachment?.url)
        .filter((url): url is string => typeof url === "string" && url.length > 0);

    const noteContentParts = [
        `**Discord - ${authorTag}**`,
        ...(postLink ? [`Post: ${postLink}`] : []),
        content || "_(no text content)_"
    ];
    if (attachmentLines.length > 0) {
        noteContentParts.push(`Attachments:\n${attachmentLines.join("\n")}`);
    }

    try {
        await (db as any).note.create({
            data: {
                issueId: issue.id,
                authorId: noteAuthor.id,
                content: noteContentParts.join("\n\n"),
                source: "DISCORD",
                discordMessageId: messageId,
                discordAuthorId: author.id,
                discordAuthorTag: authorTag,
            }
        });
        revalidateIssue(issue.id);
    } catch (error: unknown) {
        if (!isRecord(error) || error.code !== "P2002") {
            throw error;
        }
    }
}

async function handleThreadUpdate(data: DiscordThreadUpdateData) {
    const threadId = data.id;
    const archived = data.archived === true;

    if (!threadId || !archived) {
        return;
    }

    const issue = await (db as any).issue.findUnique({
        where: { discordThreadId: threadId },
        select: { id: true, status: true },
    });

    if (!issue || issue.status === "DONE") {
        return;
    }

    await (db as any).issue.update({
        where: { id: issue.id },
        data: { status: "DONE" },
    });

    revalidateIssue(issue.id);
}

export async function POST(req: Request) {
    const rawBody = await req.text();

    const signature = req.headers.get("x-signature-ed25519");
    const timestamp = req.headers.get("x-signature-timestamp");
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    const relaySecret = process.env.DISCORD_WEBHOOK_SECRET;
    const relayHeader = req.headers.get("x-discord-webhook-secret");

    if (publicKey && signature && timestamp) {
        const valid = verifyDiscordRequest(rawBody, signature, timestamp, publicKey);
        if (!valid) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
    } else if (relaySecret) {
        if (!relayHeader || relayHeader !== relaySecret) {
            return NextResponse.json({ error: "Unauthorized relay" }, { status: 401 });
        }
    } else {
        return NextResponse.json(
            { error: "Missing webhook validation configuration" },
            { status: 500 }
        );
    }

    let payload: unknown = null;
    try {
        payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Discord interaction handshake support.
    if (isRecord(payload) && payload.type === 1) {
        return NextResponse.json({ type: 1 });
    }

    const event = parseEvent(payload);
    if (!event) {
        return NextResponse.json({ ok: true, ignored: true });
    }

    if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGECREATE") {
        await handleMessageCreate(event.data);
        return NextResponse.json({ ok: true, handled: "MESSAGE_CREATE" });
    }

    if (event.type === "THREAD_UPDATE" || event.type === "THREADUPDATE") {
        await handleThreadUpdate(event.data);
        return NextResponse.json({ ok: true, handled: "THREAD_UPDATE" });
    }

    return NextResponse.json({ ok: true, ignored: event.type });
}
