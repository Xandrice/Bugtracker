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
