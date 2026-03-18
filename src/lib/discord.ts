export async function sendDiscordDM(discordId: string, content: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.warn("No DISCORD_BOT_TOKEN set. Cannot send DM to", discordId);
        return;
    }

    try {
        // Create DM channel
        const channelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
            method: "POST",
            headers: {
                "Authorization": `Bot ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ recipient_id: discordId })
        });

        if (!channelRes.ok) {
            console.error("Failed to create DM channel", await channelRes.text());
            return;
        }

        const channel = await channelRes.json();

        // Send message
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bot ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });

        if (!msgRes.ok) {
            console.error("Failed to send DM message", await msgRes.text());
        }
    } catch (error) {
        console.error("Error sending Discord DM", error);
    }
}
