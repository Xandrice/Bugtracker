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
        signal: init.signal ?? AbortSignal.timeout(10000),
        headers: {
            "Authorization": `Bot ${token}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
        }
    });
}

export type ForumWebhook = { id: string; token: string };
export type DiscordChannel = { id: string; parent_id?: string; guild_id?: string; thread_metadata?: { archived: boolean } };
async function checkedDiscord<T>(path: string, init: RequestInit): Promise<T> {
    const response = await discordApi(path, init);
    if (!response?.ok) throw new Error(response ? `Discord request failed (${response.status}).` : "Discord bot is not configured.");
    return response.status === 204 ? undefined as T : await response.json() as T;
}
export function readDiscordChannel(channelId: string) {
    return checkedDiscord<DiscordChannel>(`/channels/${channelId}`, { method: "GET", cache: "no-store" });
}
export async function createForumWebhook(channelId: string): Promise<ForumWebhook> {
    // Tokens are returned only for webhooks created by this bot.
    const existing = await checkedDiscord<Array<{ id: string; token?: string; name: string }>>(`/channels/${channelId}/webhooks`, { method: "GET", cache: "no-store" });
    const webhook = existing.find(item => item.name === "Tracker replies" && item.token);
    if (webhook?.token) return { id: webhook.id, token: webhook.token };
    return checkedDiscord<ForumWebhook>(`/channels/${channelId}/webhooks`, { method: "POST", body: JSON.stringify({ name: "Tracker replies" }) });
}
async function webhookRequest(webhook: ForumWebhook, threadId: string, messageId: string | null, method: "POST" | "PATCH" | "DELETE", payload?: unknown) {
    const path = `/webhooks/${webhook.id}/${webhook.token}${messageId ? `/messages/${messageId}` : ""}?thread_id=${threadId}&wait=true`;
    const response = await fetch(`https://discord.com/api/v10${path}`, { method, headers: { "Content-Type": "application/json" }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!response.ok && !(method === "DELETE" && response.status === 404)) throw new Error(`Discord webhook request failed (${response.status}).`);
    return response.status === 204 || response.status === 404 ? null : await response.json() as { id: string };
}
export function sendWebhookMessage(webhook: ForumWebhook, threadId: string, payload: unknown) { return webhookRequest(webhook, threadId, null, "POST", payload); }
export function editWebhookMessage(webhook: ForumWebhook, threadId: string, messageId: string, payload: unknown) { return webhookRequest(webhook, threadId, messageId, "PATCH", payload); }
export function deleteWebhookMessage(webhook: ForumWebhook, threadId: string, messageId: string) { return webhookRequest(webhook, threadId, messageId, "DELETE"); }
export function sendBotThreadMessage(threadId: string, payload: unknown) { return checkedDiscord<{ id: string }>(`/channels/${threadId}/messages`, { method: "POST", body: JSON.stringify(payload) }); }
export function editBotThreadMessage(threadId: string, messageId: string, payload: unknown) { return checkedDiscord<{ id: string }>(`/channels/${threadId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export async function deleteBotThreadMessage(threadId: string, messageId: string) {
    const response = await discordApi(`/channels/${threadId}/messages/${messageId}`, { method: "DELETE" });
    if (!response?.ok && response?.status !== 404) throw new Error("Could not delete the Discord message. Check bot permissions and retry.");
}
export function setDiscordThreadArchived(threadId: string, archived: boolean) { return checkedDiscord<DiscordChannel>(`/channels/${threadId}`, { method: "PATCH", body: JSON.stringify({ archived }) }); }
export function createDiscordForumPost(forumId: string, title: string, content: string) {
    return checkedDiscord<DiscordChannel>(`/channels/${forumId}/threads`, { method: "POST", body: JSON.stringify({ name: title.slice(0, 100), auto_archive_duration: 10080, message: { content: content.slice(0, 2000), allowed_mentions: { parse: [] } } }) });
}

export function getAppBaseUrl() {
    return process.env.NEXTAUTH_URL
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
        || "http://localhost:3000";
}

export type DiscordUserProfile = {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
    image: string;
};

export function buildDiscordAvatarUrl(discordId: string, avatarHash: string | null | undefined): string | null {
    if (!avatarHash) return null;
    const format = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${format}`;
}

export function buildDiscordDefaultAvatarUrl(discordId: string): string {
    const index = Number((BigInt(discordId) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function resolveDiscordAvatarUrl(
    discordId: string,
    avatarHash: string | null | undefined
): string {
    return buildDiscordAvatarUrl(discordId, avatarHash) ?? buildDiscordDefaultAvatarUrl(discordId);
}

function normalizeDiscordUserProfile(payload: unknown): DiscordUserProfile | null {
    if (!isRecord(payload)) return null;
    const id = typeof payload.id === "string" ? payload.id : null;
    const username = typeof payload.username === "string" ? payload.username : null;
    if (!id || !username) return null;

    const globalName =
        typeof payload.global_name === "string" && payload.global_name
            ? payload.global_name
            : null;
    const avatar = typeof payload.avatar === "string" ? payload.avatar : null;

    return {
        id,
        username,
        globalName,
        avatar,
        image: resolveDiscordAvatarUrl(id, avatar),
    };
}

export async function fetchDiscordUser(discordId: string): Promise<DiscordUserProfile | null> {
    if (!discordId || !getDiscordToken()) return null;

    try {
        const response = await discordApi(`/users/${discordId}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response || !response.ok) return null;
        const payload = await response.json();
        return normalizeDiscordUserProfile(payload);
    } catch (error) {
        console.error("Error fetching Discord user profile", discordId, error);
        return null;
    }
}

export async function fetchDiscordUsers(
    discordIds: string[]
): Promise<Map<string, DiscordUserProfile>> {
    const uniqueIds = [...new Set(discordIds.filter(Boolean))];
    const results = await Promise.all(
        uniqueIds.map(async (discordId) => {
            const profile = await fetchDiscordUser(discordId);
            return profile ? ([discordId, profile] as const) : null;
        })
    );

    return new Map(results.filter((entry): entry is [string, DiscordUserProfile] => entry !== null));
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
    edited_timestamp?: string;
    webhook_id?: string;
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
        edited_timestamp: typeof payload.edited_timestamp === "string" ? payload.edited_timestamp : undefined,
        webhook_id: typeof payload.webhook_id === "string" ? payload.webhook_id : undefined,
        author,
        attachments,
    };
}

export async function getDiscordChannelMessages(channelId: string, limit = 50, before?: string): Promise<DiscordApiMessage[] | null> {
    const token = getDiscordToken();
    if (!token || !channelId) {
        return null;
    }

    try {
        const response = await discordApi(`/channels/${channelId}/messages?limit=${Math.min(Math.max(limit, 1), 100)}${before ? `&before=${encodeURIComponent(before)}` : ""}`, {
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
