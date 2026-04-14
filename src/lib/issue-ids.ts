export function formatIssueRef(issueNumber: number | null | undefined, fallbackId?: string): string {
    if (typeof issueNumber === "number" && Number.isFinite(issueNumber)) {
        return `rrp-${String(issueNumber).padStart(3, "0")}`;
    }
    return fallbackId ?? "rrp-000";
}

export function parseIssueRef(value: string): number | null {
    const match = value.trim().match(/^rrp-(\d+)$/i);
    if (!match) return null;
    return Number.parseInt(match[1], 10);
}
