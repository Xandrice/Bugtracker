import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export function authorizeDiscordWebhook(req: Request): NextResponse | null {
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

    return null;
}

export function parseDiscordPostInput(
    value: string | null | undefined
): { postId: string | null; postLink: string | null } {
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

export function normalizeDiscordSnowflake(value: string | null | undefined): string | null {
    const raw = (value || "").trim();
    if (!raw) return null;

    const mention = raw.match(/^<@!?(\d+)>$/);
    if (mention) return mention[1];

    const prefixed = raw.match(/^discord:(\d+)$/i);
    if (prefixed) return prefixed[1];

    return raw;
}

export async function getOrCreateUserFromDiscordId(
    discordId: string,
    userName?: string | null,
    userAvatar?: string | null
) {
    const existingAccount = await db.account.findUnique({
        where: {
            provider_providerAccountId: {
                provider: "discord",
                providerAccountId: discordId,
            },
        },
        include: { user: true },
    });

    if (existingAccount?.user) {
        return existingAccount.user;
    }

    const preferredName = userName || `Discord ${discordId}`;
    const avatarHash = userAvatar as string | undefined;
    const image = avatarHash
        ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`
        : null;

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
