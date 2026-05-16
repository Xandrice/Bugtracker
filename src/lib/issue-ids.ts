import { randomBytes } from "node:crypto";

// Lowercase alphanumerics with ambiguous chars (0/1/i/l/o) removed.
// 31 chars ^ 8 length ≈ 8.5e11 combinations — plenty of headroom for a team tracker.
const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const ID_LENGTH = 8;

export function generateIssuePublicKey(length: number = ID_LENGTH): string {
    const alphabet = ID_ALPHABET;
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
}

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
