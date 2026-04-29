import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./src/lib/db"

const isDev = process.env.NODE_ENV !== "production"
const devAuthUsername = process.env.DEV_AUTH_USERNAME || "dev"
const devAuthPassword = process.env.DEV_AUTH_PASSWORD || "dev"
const enableDevAutoAuth = isDev && process.env.DEV_AUTO_AUTH !== "false"

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
        async signIn({ user, account }) {
            if (account?.provider === "discord" && account.providerAccountId) {
                const discordId = account.providerAccountId;
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

export const auth = async (
    ...args: Parameters<typeof nextAuthAuth>
): Promise<Awaited<ReturnType<typeof nextAuthAuth>>> => {
    const session = await nextAuthAuth(...args)
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

    return mergedSession as Awaited<ReturnType<typeof nextAuthAuth>>
}
