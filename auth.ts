import NextAuth from "next-auth"
import type { Session } from "next-auth"
import Discord from "next-auth/providers/discord"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./src/lib/db"

const isDev = process.env.NODE_ENV !== "production"
const devAuthUsername = process.env.DEV_AUTH_USERNAME || "dev"
const devAuthPassword = process.env.DEV_AUTH_PASSWORD || "dev"
const enableDevAutoAuth = isDev && process.env.DEV_AUTO_AUTH !== "false"

function discordAvatarUrl(profile: unknown): string | null {
    if (typeof profile !== "object" || profile === null) return null
    const { id, avatar } = profile as { id?: unknown; avatar?: unknown }
    if (typeof id !== "string" || typeof avatar !== "string" || !avatar) return null
    const format = avatar.startsWith("a_") ? "gif" : "png"
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${format}`
}

function discordDisplayName(profile: unknown): string | null {
    if (typeof profile !== "object" || profile === null) return null
    const { global_name: globalName, username } = profile as {
        global_name?: unknown
        username?: unknown
    }
    if (typeof globalName === "string" && globalName) return globalName
    if (typeof username === "string" && username) return username
    return null
}

const nextAuth = NextAuth({
    adapter: PrismaAdapter(db),
    providers: [
        Discord,
        ...(isDev
            ? [
                Credentials({
                    id: "credentials",
                    name: "Local Dev Login",
                    credentials: {
                        username: { label: "Username", type: "text" },
                        password: { label: "Password", type: "password" },
                    },
                    async authorize(credentials) {
                        const username = String(credentials?.username || "").trim();
                        const password = String(credentials?.password || "");
                        if (!username || password !== devAuthPassword) return null;
                        if (username !== devAuthUsername) return null;

                        const email = `${devAuthUsername}@local.dev`;
                        const existing = await db.user.findUnique({ where: { email } });
                        if (existing) return existing;

                        return db.user.create({
                            data: {
                                name: "Local Dev",
                                email,
                            },
                        });
                    },
                }),
            ]
            : []),
    ],
    secret: process.env.AUTH_SECRET,
    basePath: "/api/auth",
    session: { strategy: "jwt" },
    trustHost: true,
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "discord" && account.providerAccountId) {
                const discordId = account.providerAccountId;

                // Refresh the stored avatar/name so Discord profile changes
                // (e.g. a new profile picture) are reflected on every login.
                const image = discordAvatarUrl(profile);
                const name = discordDisplayName(profile);
                if (image) user.image = image;
                if (name) user.name = name;
                try {
                    const existingAccount = await db.account.findUnique({
                        where: {
                            provider_providerAccountId: {
                                provider: "discord",
                                providerAccountId: discordId,
                            },
                        },
                        select: { userId: true },
                    });
                    if (existingAccount?.userId && (image || name)) {
                        await db.user.update({
                            where: { id: existingAccount.userId },
                            data: {
                                ...(image ? { image } : {}),
                                ...(name ? { name } : {}),
                            },
                        });
                    }
                } catch {
                    // Non-fatal: failing to refresh the avatar should not block sign-in.
                }

                const member = await (db as any).projectMember.findUnique({
                    where: { discordId }
                });
                if (member) return true;

                const count = await (db as any).projectMember.count();
                if (count === 0) {
                    await (db as any).projectMember.create({
                        data: { discordId, role: "Admin" }
                    });
                    return true;
                }
                return false;
            }
            return true;
        },
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            return session
        }
    }
})

export const { handlers, signIn, signOut } = nextAuth

const nextAuthAuth = nextAuth.auth

async function getOrCreateDevUser() {
    const email = `${devAuthUsername}@local.dev`
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return existing

    return db.user.create({
        data: {
            name: "Local Dev",
            email,
        },
    })
}

export const auth = async (): Promise<Session | null> => {
    const session = await nextAuthAuth()
    if (session?.user?.id || !enableDevAutoAuth) return session

    let devUser: Awaited<ReturnType<typeof getOrCreateDevUser>> | null = null
    try {
        devUser = await getOrCreateDevUser()
    } catch {
        // In local dev we still want the app shell to load even when DB/auth bootstrap fails.
        devUser = null
    }

    const mergedSession = {
        ...(session ?? {}),
        user: {
            ...(session?.user ?? {}),
            id: devUser?.id ?? "local-dev-user",
            name: session?.user?.name ?? devUser?.name ?? "Local Dev",
            email: session?.user?.email ?? devUser?.email ?? "local-dev@local.dev",
            image: session?.user?.image ?? devUser?.image ?? null,
        },
        expires: session?.expires ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }

    return mergedSession as Session
}
