function getDiscordToken() {
    return process.env.DISCORD_BOT_TOKEN;
}

async function discordApi(path: string, init: RequestInit) {
    const token = getDiscordToken();
    if (!token) {
        return null;
    }

    return fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers: {
            "Authorization": `Bot ${token}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
        }
    });
}

export function getAppBaseUrl() {
    return process.env.NEXTAUTH_URL
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
        || "http://localhost:3000";
}

export async function sendDiscordDM(discordId: string, content: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.warn("No DISCORD_BOT_TOKEN set. Cannot send DM to", discordId);
        return;
    }

    try {
        // Create DM channel
        const channelRes = await discordApi("/users/@me/channels", {
            method: "POST",
            body: JSON.stringify({ recipient_id: discordId })
        });

        if (!channelRes || !channelRes.ok) {
            console.error("Failed to create DM channel", channelRes ? await channelRes.text() : "No response");
            return;
        }

        const channel = await channelRes.json();

        // Send message
        const msgRes = await discordApi(`/channels/${channel.id}/messages`, {
            method: "POST",
            body: JSON.stringify({ content })
        });

        if (!msgRes || !msgRes.ok) {
            console.error("Failed to send DM message", msgRes ? await msgRes.text() : "No response");
        }
    } catch (error) {
        console.error("Error sending Discord DM", error);
    }
}

export async function sendDiscordChannelMessage(channelId: string, content: string) {
    const token = getDiscordToken();
    if (!token) {
        console.warn("No DISCORD_BOT_TOKEN set. Cannot send channel message to", channelId);
        return null;
    }

    try {
        const messageRes = await discordApi(`/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({ content }),
        });

        if (!messageRes || !messageRes.ok) {
            console.error("Failed to send channel message", messageRes ? await messageRes.text() : "No response");
            return null;
        }

        const payload = await messageRes.json();
        return payload?.id as string | undefined;
    } catch (error) {
        console.error("Error sending Discord channel message", error);
        return null;
    }
}

type DiscordApiAuthor = {
    id?: string;
    username?: string;
    global_name?: string;
    discriminator?: string;
    avatar?: string;
    bot?: boolean;
};

type DiscordApiAttachment = {
    url?: string;
};

type DiscordApiMessage = {
    id?: string;
    channel_id?: string;
    guild_id?: string;
    content?: string;
    timestamp?: string;
    author?: DiscordApiAuthor;
    attachments?: DiscordApiAttachment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeDiscordApiMessage(payload: unknown): DiscordApiMessage | null {
    if (!isRecord(payload)) return null;

    const attachmentsRaw = Array.isArray(payload.attachments) ? payload.attachments : [];
    const attachments = attachmentsRaw
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => ({ url: typeof item.url === "string" ? item.url : undefined }));

    const authorRaw = isRecord(payload.author) ? payload.author : null;
    const author = authorRaw
        ? {
            id: typeof authorRaw.id === "string" ? authorRaw.id : undefined,
            username: typeof authorRaw.username === "string" ? authorRaw.username : undefined,
            global_name: typeof authorRaw.global_name === "string" ? authorRaw.global_name : undefined,
            discriminator: typeof authorRaw.discriminator === "string" ? authorRaw.discriminator : undefined,
            avatar: typeof authorRaw.avatar === "string" ? authorRaw.avatar : undefined,
            bot: typeof authorRaw.bot === "boolean" ? authorRaw.bot : undefined,
        }
        : undefined;

    return {
        id: typeof payload.id === "string" ? payload.id : undefined,
        channel_id: typeof payload.channel_id === "string" ? payload.channel_id : undefined,
        guild_id: typeof payload.guild_id === "string" ? payload.guild_id : undefined,
        content: typeof payload.content === "string" ? payload.content : undefined,
        timestamp: typeof payload.timestamp === "string" ? payload.timestamp : undefined,
        author,
        attachments,
    };
}

export async function getDiscordChannelMessages(channelId: string, limit = 50): Promise<DiscordApiMessage[] | null> {
    const token = getDiscordToken();
    if (!token || !channelId) {
        return null;
    }

    try {
        const response = await discordApi(`/channels/${channelId}/messages?limit=${Math.min(Math.max(limit, 1), 100)}`, {
            method: "GET",
            cache: "no-store",
        });

        if (!response || !response.ok) {
            console.error("Failed to fetch Discord channel messages", response ? await response.text() : "No response");
            return null;
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
            return null;
        }

        return payload
            .map(normalizeDiscordApiMessage)
            .filter((message): message is DiscordApiMessage => message !== null && typeof message.id === "string");
    } catch (error) {
        console.error("Error fetching Discord channel messages", error);
        return null;
    }
}

export async function getDiscordChannelMessage(channelId: string, messageId: string): Promise<DiscordApiMessage | null> {
    const token = getDiscordToken();
    if (!token || !channelId || !messageId) {
        return null;
    }

    try {
        const response = await discordApi(`/channels/${channelId}/messages/${messageId}`, {
            method: "GET",
            cache: "no-store",
        });

        if (!response || !response.ok) {
            console.error("Failed to fetch Discord message", response ? await response.text() : "No response");
            return null;
        }

        const payload = await response.json();
        return normalizeDiscordApiMessage(payload);
    } catch (error) {
        console.error("Error fetching Discord message", error);
        return null;
    }
}
