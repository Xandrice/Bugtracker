import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { evenlySpacedRanks, rankBetween } from "@/lib/backlog-rank";

const BACKLOG_STATUS = "BACKLOG";

const rankOrderBy = [
    { backlogRank: { sort: "asc" as const, nulls: "last" as const } },
    { id: "asc" as const },
];

async function lockBacklogRows(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM "Issue" WHERE status = ${BACKLOG_STATUS} FOR UPDATE`;
}

/** Next rank after the last current BACKLOG item (bottom of the list). */
export async function nextBacklogRank(tx: Prisma.TransactionClient): Promise<string> {
    await lockBacklogRows(tx);
    const last = await tx.issue.findFirst({
        where: { status: BACKLOG_STATUS, backlogRank: { not: null } },
        orderBy: { backlogRank: "desc" },
        select: { backlogRank: true },
    });
    return rankBetween(last?.backlogRank ?? null, null);
}

/**
 * Keep an existing rank when re-entering BACKLOG; otherwise append.
 * Call inside a transaction.
 */
export async function rankWhenEnteringBacklog(
    tx: Prisma.TransactionClient,
    existingRank: string | null | undefined
): Promise<string> {
    if (existingRank) return existingRank;
    return nextBacklogRank(tx);
}

/** Assign ranks to BACKLOG rows that are still null (legacy / missed paths). */
export async function ensureMissingBacklogRanks() {
    const missingCount = await db.issue.count({
        where: { status: BACKLOG_STATUS, backlogRank: null },
    });
    if (missingCount === 0) return;

    await db.$transaction(async (tx) => {
        await lockBacklogRows(tx);
        const missing = await tx.issue.findMany({
            where: { status: BACKLOG_STATUS, backlogRank: null },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            select: { id: true },
        });
        if (missing.length === 0) return;

        const last = await tx.issue.findFirst({
            where: { status: BACKLOG_STATUS, backlogRank: { not: null } },
            orderBy: { backlogRank: "desc" },
            select: { backlogRank: true },
        });

        let prev = last?.backlogRank ?? null;
        for (const row of missing) {
            const rank = rankBetween(prev, null);
            await tx.issue.update({
                where: { id: row.id },
                data: { backlogRank: rank },
            });
            prev = rank;
        }
    });
}

type RankedRow = { id: string; backlogRank: string | null };

async function rebalanceToPosition(
    tx: Prisma.TransactionClient,
    issueId: string,
    others: RankedRow[],
    afterId: string | null,
    beforeId: string | null
): Promise<{ error?: string }> {
    let insertAt = others.length;
    if (afterId) {
        const idx = others.findIndex((r) => r.id === afterId);
        if (idx === -1) return { error: "Invalid drop position" };
        insertAt = idx + 1;
    } else if (beforeId) {
        const idx = others.findIndex((r) => r.id === beforeId);
        if (idx === -1) return { error: "Invalid drop position" };
        insertAt = idx;
    }

    const orderedIds = [
        ...others.slice(0, insertAt).map((r) => r.id),
        issueId,
        ...others.slice(insertAt).map((r) => r.id),
    ];
    const ranks = evenlySpacedRanks(orderedIds.length);
    for (let i = 0; i < orderedIds.length; i += 1) {
        await tx.issue.update({
            where: { id: orderedIds[i] },
            data: { backlogRank: ranks[i] },
        });
    }
    return {};
}

/**
 * Place `issueId` between the given neighbors. `afterId`/`beforeId` may be
 * non-adjacent when the client is showing a filtered subset.
 */
export async function placeBacklogIssue(params: {
    issueId: string;
    afterId: string | null;
    beforeId: string | null;
}): Promise<{ error?: string }> {
    const { issueId, afterId, beforeId } = params;
    if (afterId === issueId || beforeId === issueId) {
        return { error: "Invalid drop position" };
    }

    return db.$transaction(async (tx) => {
        await lockBacklogRows(tx);

        const issue = await tx.issue.findUnique({
            where: { id: issueId },
            select: { id: true, status: true, backlogRank: true },
        });
        if (!issue) return { error: "Issue not found" };
        if (issue.status !== BACKLOG_STATUS) {
            return { error: "Only backlog issues can be reordered" };
        }

        const rows = await tx.issue.findMany({
            where: { status: BACKLOG_STATUS },
            select: { id: true, backlogRank: true },
            orderBy: rankOrderBy,
        });
        const others = rows.filter((r) => r.id !== issueId);

        if (!afterId && !beforeId) {
            if (others.length === 0 && !issue.backlogRank) {
                await tx.issue.update({
                    where: { id: issueId },
                    data: { backlogRank: rankBetween(null, null) },
                });
            }
            return {};
        }

        if (afterId && !others.some((r) => r.id === afterId)) {
            return { error: "Invalid drop position" };
        }
        if (beforeId && !others.some((r) => r.id === beforeId)) {
            return { error: "Invalid drop position" };
        }

        let prevRank: string | null = null;
        let nextRank: string | null = null;

        if (afterId) {
            prevRank = others.find((r) => r.id === afterId)?.backlogRank ?? null;
        } else if (beforeId) {
            const beforeIdx = others.findIndex((r) => r.id === beforeId);
            prevRank = beforeIdx > 0 ? others[beforeIdx - 1]!.backlogRank : null;
        }

        if (beforeId) {
            nextRank = others.find((r) => r.id === beforeId)?.backlogRank ?? null;
        } else if (afterId) {
            const afterIdx = others.findIndex((r) => r.id === afterId);
            nextRank = afterIdx >= 0 && afterIdx + 1 < others.length
                ? others[afterIdx + 1]!.backlogRank
                : null;
        }

        const neighborsNeedRebalance =
            (afterId != null && prevRank == null) ||
            (beforeId != null && nextRank == null) ||
            (prevRank != null && nextRank != null && prevRank >= nextRank);

        if (neighborsNeedRebalance) {
            return rebalanceToPosition(tx, issueId, others, afterId, beforeId);
        }

        try {
            const rank = rankBetween(prevRank, nextRank);
            await tx.issue.update({
                where: { id: issueId },
                data: { backlogRank: rank },
            });
            return {};
        } catch {
            return rebalanceToPosition(tx, issueId, others, afterId, beforeId);
        }
    });
}
