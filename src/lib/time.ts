const ACTIVE_NOW_MS = 15 * 60 * 1000;
const RECENTLY_ACTIVE_MS = 24 * 60 * 60 * 1000;

export function formatRelativeTime(date: Date | string | null | undefined): string {
    if (!date) return "Never";
    const value = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return "Never";

    const diff = Date.now() - value.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return value.toLocaleDateString();
}

export type MemberActivityStatus = "active" | "recent" | "inactive";

export function getMemberActivityStatus(
    lastSeenAt: Date | string | null | undefined
): MemberActivityStatus {
    if (!lastSeenAt) return "inactive";
    const value = typeof lastSeenAt === "string" ? new Date(lastSeenAt) : lastSeenAt;
    if (Number.isNaN(value.getTime())) return "inactive";

    const age = Date.now() - value.getTime();
    if (age <= ACTIVE_NOW_MS) return "active";
    if (age <= RECENTLY_ACTIVE_MS) return "recent";
    return "inactive";
}

export function formatMemberActivityLabel(
    lastSeenAt: Date | string | null | undefined
): string {
    const status = getMemberActivityStatus(lastSeenAt);
    if (status === "active") return "Active now";
    if (!lastSeenAt) return "Never signed in";
    return formatRelativeTime(lastSeenAt);
}
