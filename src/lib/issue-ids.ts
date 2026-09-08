export function formatIssueRef(publicKey: string | null | undefined, fallbackId?: string): string {
    if (publicKey && publicKey.length > 0) return publicKey;
    return fallbackId ?? "";
}

/**
 * Returns true if the value looks like a generated short public key
 * (8 chars, lowercase alphanumerics from our alphabet). Used to disambiguate
 * URL params between a cuid and a publicKey on lookup.
 */
export function isLikelyPublicKey(value: string): boolean {
    if (!value) return false;
    if (value.length < 6 || value.length > 16) return false;
    return /^[a-z0-9]+$/i.test(value);
}
