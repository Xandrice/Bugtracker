import { db } from "@/lib/db";
import { fetchDiscordUsers, type DiscordUserProfile } from "@/lib/discord";

const PROFILE_STALE_MS = 24 * 60 * 60 * 1000;

type MemberSyncInput = {
    id: string;
    discordId: string;
    discordDisplayName: string | null;
    discordAvatar: string | null;
    profileSyncedAt: Date | null;
    userId: string | null;
    userImage: string | null;
};

export type ResolvedMemberProfile = {
    name: string | null;
    image: string | null;
    lastSeenAt: Date | null;
};

function isProfileStale(member: MemberSyncInput): boolean {
    if (!member.profileSyncedAt) return true;
    return Date.now() - member.profileSyncedAt.getTime() > PROFILE_STALE_MS;
}

function needsDiscordSync(member: MemberSyncInput, force = false): boolean {
    if (force) return true;
    if (!member.userId) return isProfileStale(member) || !member.discordAvatar;
    return isProfileStale(member) || !member.userImage;
}

export async function syncProjectMemberProfiles(
    members: MemberSyncInput[],
    lastSeenByUserId: Map<string, Date | null>,
    options?: { force?: boolean }
): Promise<Map<string, ResolvedMemberProfile>> {
    const force = options?.force ?? false;
    const toSync = members.filter((member) => needsDiscordSync(member, force));
    const profiles =
        toSync.length > 0
            ? await fetchDiscordUsers(toSync.map((member) => member.discordId))
            : new Map<string, DiscordUserProfile>();

    const now = new Date();
    const resolved = new Map<string, ResolvedMemberProfile>();

    await Promise.all(
        members.map(async (member) => {
            const profile = profiles.get(member.discordId);
            const linkedLastSeen = member.userId
                ? lastSeenByUserId.get(member.userId) ?? null
                : null;

            if (profile) {
                await db.projectMember.update({
                    where: { id: member.id },
                    data: {
                        discordDisplayName: profile.globalName || profile.username,
                        discordAvatar: profile.image,
                        profileSyncedAt: now,
                    },
                });

                if (member.userId) {
                    await db.user.update({
                        where: { id: member.userId },
                        data: {
                            name: profile.globalName || profile.username,
                            image: profile.image,
                        },
                    });
                }

                resolved.set(member.discordId, {
                    name: profile.globalName || profile.username,
                    image: profile.image,
                    lastSeenAt: linkedLastSeen,
                });
                return;
            }

            const cachedName = member.discordDisplayName;
            const cachedImage = member.discordAvatar || member.userImage;
            resolved.set(member.discordId, {
                name: cachedName,
                image: cachedImage,
                lastSeenAt: linkedLastSeen,
            });
        })
    );

    return resolved;
}

export async function syncProjectMemberProfileByDiscordId(discordId: string) {
    const member = await db.projectMember.findUnique({
        where: { discordId },
        select: {
            id: true,
            discordId: true,
            discordDisplayName: true,
            discordAvatar: true,
            profileSyncedAt: true,
        },
    });
    if (!member) return;

    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: discordId },
        select: { userId: true, user: { select: { image: true, lastSeenAt: true } } },
    });

    const lastSeenByUserId = new Map<string, Date | null>();
    if (account?.userId) {
        lastSeenByUserId.set(account.userId, account.user.lastSeenAt);
    }

    await syncProjectMemberProfiles(
        [
            {
                ...member,
                userId: account?.userId ?? null,
                userImage: account?.user.image ?? null,
            },
        ],
        lastSeenByUserId
    );
}
