import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./src/lib/db"

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(db),
    providers: [Discord],
    session: { strategy: "jwt" },
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
