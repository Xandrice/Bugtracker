/**
 * Lexicographic ranks for the issue backlog.
 *
 * Smaller rank sorts first (top of the list). Inserting between two neighbors
 * only needs a midpoint string — we do not rewrite every row on drop.
 *
 * Alphabet is [0-9a-z]. If two ranks are adjacent with no remaining space,
 * `rankBetween` throws and the caller rebalances the list.
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const MIN_DIGIT = 0;
const MAX_DIGIT = BASE - 1;
const MAX_DEPTH = 64;

function toDigits(rank: string): number[] {
    const out: number[] = [];
    for (const ch of rank) {
        const v = DIGITS.indexOf(ch);
        if (v < 0) {
            throw new Error(`Invalid backlog rank: ${rank}`);
        }
        out.push(v);
    }
    return out;
}

function fromDigits(digits: number[]): string {
    return digits.map((d) => DIGITS[d]).join("");
}

function encodeFixed(value: number, width: number): string {
    let n = Math.max(0, Math.floor(value));
    let out = "";
    for (let i = 0; i < width; i += 1) {
        out = DIGITS[n % BASE] + out;
        n = Math.floor(n / BASE);
    }
    return out;
}

/**
 * Return a rank that sorts strictly between `prev` and `next`.
 * `null` is an open bound (start or end of the list).
 */
export function rankBetween(prev: string | null, next: string | null): string {
    if (prev !== null && next !== null && prev >= next) {
        throw new Error(`Invalid backlog rank bounds: "${prev}" >= "${next}"`);
    }

    const prevDigits = prev ? toDigits(prev) : [];
    const nextDigits = next ? toDigits(next) : [];
    const result: number[] = [];
    let nextIsOpen = next === null;
    let i = 0;

    while (true) {
        const prevVal = i < prevDigits.length ? prevDigits[i]! : MIN_DIGIT;
        const nextVal = nextIsOpen
            ? MAX_DIGIT + 1
            : i < nextDigits.length
              ? nextDigits[i]!
              : MIN_DIGIT;
        const gap = nextVal - prevVal;

        if (gap > 1) {
            result.push(Math.floor((prevVal + nextVal) / 2));
            return fromDigits(result);
        }

        if (gap < 0 || (gap === 0 && i >= prevDigits.length && i >= nextDigits.length)) {
            throw new Error("No space between backlog ranks");
        }

        result.push(prevVal);
        if (gap === 1) {
            // Continuations of `result` still sort before `next`.
            nextIsOpen = true;
        }
        i += 1;
        if (i > MAX_DEPTH) {
            throw new Error("backlog rank exceeded max depth");
        }
    }
}

/** Evenly spaced ranks used when a local insert has no remaining gap. */
export function evenlySpacedRanks(count: number): string[] {
    if (count <= 0) return [];

    const width = 4;
    const span = BASE ** width;
    const ranks: string[] = [];
    for (let i = 1; i <= count; i += 1) {
        const value = Math.floor((i * span) / (count + 1));
        ranks.push(encodeFixed(value, width));
    }

    for (let i = 1; i < ranks.length; i += 1) {
        if (ranks[i]! <= ranks[i - 1]!) {
            ranks[i] = rankBetween(ranks[i - 1]!, ranks[i + 1] ?? null);
        }
    }
    return ranks;
}

export function compareBacklogRank(a: string | null | undefined, b: string | null | undefined): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}
