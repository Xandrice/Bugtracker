"use server";

import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createIssue(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const type = formData.get("type") as string;
    const priority = formData.get("priority") as string;
    const severity = (formData.get("severity") as string) || "MINOR";
    const environment = formData.get("environment") as string | null;
    const tags = formData.get("tags") as string | null;

    if (!title || !type || !priority) {
        throw new Error("Missing required fields");
    }

    await db.issue.create({
        data: {
            title,
            description,
            type,
            priority,
            severity,
            environment,
            tags,
            reporterId: session.user.id,
        }
    });

    revalidatePath("/issues");
    revalidatePath("/boards/triage");
    revalidatePath("/boards/main");
    redirect("/issues");
}

export async function updateIssueStatus(issueId: string, status: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    await db.issue.update({
        where: { id: issueId },
        data: { status }
    });

    revalidatePath("/boards/main");
    revalidatePath("/issues");
}

export async function createTeamNote(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const title = formData.get("title") as string | null;
    const content = formData.get("content") as string;
    const issueId = formData.get("issueId") as string | null;

    if (!content) throw new Error("Missing content");

    const data: any = {
        title,
        content,
        authorId: session.user.id,
    };

    if (issueId) {
        data.issueId = issueId;
    }

    await db.note.create({ data });

    revalidatePath("/notes");
    if (!issueId) {
        redirect("/notes");
    } else {
        revalidatePath(`/issues/${issueId}`);
    }
}

export async function addProjectMember(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const discordId = formData.get("discordId") as string;
    const role = formData.get("role") as string || "Member";

    if (!discordId) throw new Error("Missing discordId");

    await (db as any).projectMember.create({
        data: {
            discordId,
            role,
        }
    });

    revalidatePath("/members");
}

export async function updateProjectMemberRole(memberId: string, role: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await (db as any).projectMember.update({
        where: { id: memberId },
        data: { role }
    });

    revalidatePath("/members");
}

export async function removeProjectMember(memberId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await (db as any).projectMember.delete({
        where: { id: memberId }
    });

    revalidatePath("/members");
}

export async function exportProjectData() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const issues = await db.issue.findMany({
        include: {
            reporter: true,
            assignee: true,
            notes: { include: { author: true } }
        }
    });

    const members = await (db as any).projectMember.findMany();

    return { issues, members };
}

export async function deleteAllProjectData() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Clear all DB relations
    await db.note.deleteMany({});
    await db.issue.deleteMany({});
    // Depending on schema, we might not have cascading on all, but Prisma handles normal deleteMany
    // Remove users / project members if necessary? We'll only delete core task data

    revalidatePath("/issues");
    revalidatePath("/boards/main");
    revalidatePath("/boards/triage");
    revalidatePath("/members");
    revalidatePath("/");

    redirect("/");
}
