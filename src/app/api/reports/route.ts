import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/discord";
import {
    authorizeDiscordWebhook,
    getOrCreateUserFromDiscordId,
    normalizeDiscordSnowflake,
    parseDiscordPostInput,
} from "@/lib/discord-intake";

const ALLOWED_CATEGORY = [
    "CONDUCT",
    "WARNING",
    "TOXICITY",
    "HARASSMENT",
    "CHEATING",
    "OTHER",
] as const;

type CreateReportInput = {
    title: string;
    discordUserId: string;
    subjectDiscordId?: string | null;
    subjectName?: string | null;
    accusedPlayer?: string | null;
    description?: string | null;
    category?: string;
    evidenceLinks?: string | null;
    discordThreadId?: string | null;
    discordPostId?: string | null;
    discordUserName?: string | null;
    discordUserAvatar?: string | null;
    reporterName?: string | null;
};

function reportUrl(id: string) {
    return `${getAppBaseUrl()}/reports/${id}`;
}

function existingResponse(report: { id: string; title: string }) {
    return NextResponse.json(
        {
            id: report.id,
            url: reportUrl(report.id),
            title: report.title,
            existing: true,
        },
        { status: 200 }
    );
}

export async function POST(req: Request) {
    const authError = authorizeDiscordWebhook(req);
    if (authError) return authError;

    let body: Partial<CreateReportInput>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const title = body.title?.trim();
    const discordUserId = normalizeDiscordSnowflake(body.discordUserId);

    if (!title) {
        return NextResponse.json(
            { error: "Missing required field: title" },
            { status: 400 }
        );
    }

    if (!discordUserId) {
        return NextResponse.json(
            { error: "Missing required field: discordUserId" },
            { status: 400 }
        );
    }

    const category = (body.category || "OTHER").trim().toUpperCase();
    if (!(ALLOWED_CATEGORY as readonly string[]).includes(category)) {
        return NextResponse.json(
            { error: `Invalid category. Must be one of: ${ALLOWED_CATEGORY.join(", ")}` },
            { status: 400 }
        );
    }

    const discordPostRaw = body.discordThreadId || body.discordPostId;
    const { postId: discordPostId, postLink: discordPostLink } = parseDiscordPostInput(discordPostRaw);

    if (discordPostId) {
        const existing = await db.playerReport.findUnique({
            where: { discordThreadId: discordPostId },
            select: { id: true, title: true },
        });
        if (existing) return existingResponse(existing);
    }

    let reporter;
    try {
        reporter = await getOrCreateUserFromDiscordId(
            discordUserId,
            body.discordUserName,
            body.discordUserAvatar
        );
    } catch (error) {
        console.error("Failed to get or create user from Discord ID", error);
        return NextResponse.json(
            { error: "Failed to resolve Discord user" },
            { status: 500 }
        );
    }

    const subjectDiscordId = normalizeDiscordSnowflake(body.subjectDiscordId);
    const subjectName = body.subjectName?.trim() || null;
    const accusedPlayer = body.accusedPlayer?.trim() || subjectName;
    const description = body.description?.trim() || null;
    const reporterName = body.reporterName?.trim() || body.discordUserName?.trim() || null;

    const incomingEvidence = (body.evidenceLinks || "").trim();
    const threadFootnote = discordPostLink
        ? `Discord thread: ${discordPostLink}`
        : discordPostId
            ? `Discord thread: ${discordPostId}`
            : null;
    const evidenceAlreadyHasThread = Boolean(
        threadFootnote &&
            (incomingEvidence.includes(discordPostId || "") ||
                (discordPostLink ? incomingEvidence.includes(discordPostLink) : false))
    );
    const evidenceLinks =
        [incomingEvidence, evidenceAlreadyHasThread ? null : threadFootnote]
            .filter(Boolean)
            .join("\n") || null;

    let report;
    try {
        report = await db.playerReport.create({
            data: {
                title,
                description,
                reporterName,
                accusedPlayer,
                subjectDiscordId,
                subjectName,
                category,
                evidenceLinks,
                discordThreadId: discordPostId || null,
                reporter: { connect: { id: reporter.id } },
            },
        });
    } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === "P2002" && discordPostId) {
            const existing = await db.playerReport.findUnique({
                where: { discordThreadId: discordPostId },
                select: { id: true, title: true },
            });
            if (existing) return existingResponse(existing);
        }
        console.error("Failed to create player report", error);
        return NextResponse.json(
            { error: "Failed to create report" },
            { status: 500 }
        );
    }

    revalidatePath("/reports");
    revalidatePath(`/reports/${report.id}`);

    return NextResponse.json(
        {
            id: report.id,
            url: reportUrl(report.id),
            title: report.title,
            existing: false,
        },
        { status: 201 }
    );
}
