"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageCompensation,
  canViewCompensation,
  getPermissionContext,
  requirePermission,
} from "@/lib/permissions";
import { discordSignInUrl } from "@/lib/auth-urls";
import {
  canTransitionCompensation,
  isCompensationStatus,
  parseCompensationItems,
  parseMoneyAmount,
} from "@/lib/compensation";

function redirectToSignIn(callbackUrl = "/staff-tools/compensation"): never {
  redirect(discordSignInUrl(callbackUrl));
}

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const permissions = await getPermissionContext(userId);
  return { session, permissions, userId };
}

function revalidateCompensationPages(id?: string, playerIdentifier?: string) {
  revalidatePath("/staff-tools/compensation");
  if (id) revalidatePath(`/staff-tools/compensation/${id}`);
  revalidatePath("/staff-tools/players");
  if (playerIdentifier) {
    revalidatePath(`/staff-tools/players/${encodeURIComponent(playerIdentifier)}`);
  }
}

export async function createCompensationRequest(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(
    canManageCompensation(actor.permissions),
    "You do not have permission to file compensation requests."
  );
  if (denied) throw new Error(denied.error);

  const playerIdentifier = String(formData.get("playerIdentifier") || "").trim();
  const playerName = String(formData.get("playerName") || "").trim();
  const discordId = String(formData.get("discordId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const evidence = String(formData.get("evidence") || "").trim();
  const assigneeIdRaw = String(formData.get("assigneeId") || "").trim();
  const items = parseCompensationItems(String(formData.get("items") || ""));

  if (!playerIdentifier) throw new Error("Citizen ID / identifier is required.");
  if (!reason) throw new Error("Reason is required.");

  const cashAmount = parseMoneyAmount(String(formData.get("cashAmount") || ""));
  const bankAmount = parseMoneyAmount(String(formData.get("bankAmount") || ""));
  if (cashAmount == null && bankAmount == null && items.length === 0) {
    throw new Error("Add a cash amount, bank amount, and/or at least one item.");
  }

  const request = await db.compensationRequest.create({
    data: {
      playerIdentifier,
      playerName: playerName || null,
      discordId: discordId || null,
      reason,
      cashAmount,
      bankAmount,
      items: items.length > 0 ? (items as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      evidence: evidence || null,
      requesterId: actor.userId,
      assigneeId: assigneeIdRaw && assigneeIdRaw !== "none" ? assigneeIdRaw : null,
    },
  });

  revalidateCompensationPages(request.id, playerIdentifier);
  redirect(`/staff-tools/compensation/${request.id}`);
}

export async function updateCompensationRequest(formData: FormData) {
  const actor = await getActor();
  if (!actor) redirectToSignIn();

  const denied = requirePermission(
    canManageCompensation(actor.permissions),
    "You do not have permission to update compensation requests."
  );
  if (denied) throw new Error(denied.error);

  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const assigneeIdRaw = String(formData.get("assigneeId") || "").trim();
  if (!id) throw new Error("Missing compensation request id.");

  const existing = await db.compensationRequest.findUnique({
    where: { id },
    select: { id: true, status: true, playerIdentifier: true, resolverId: true, resolvedAt: true },
  });
  if (!existing) throw new Error("Compensation request not found.");

  const data: Prisma.CompensationRequestUpdateInput = {};

  if (assigneeIdRaw) {
    data.assignee = assigneeIdRaw === "none" ? { disconnect: true } : { connect: { id: assigneeIdRaw } };
  }

  if (status && status !== existing.status) {
    if (!isCompensationStatus(status) || !canTransitionCompensation(existing.status, status)) {
      throw new Error(`Cannot change status from ${existing.status} to ${status}.`);
    }

    data.status = status;

    if (status === "APPROVED" || status === "DENIED") {
      data.resolver = { connect: { id: actor.userId } };
      data.resolvedAt = new Date();
      data.payer = { disconnect: true };
      data.paidAt = null;
    }

    if (status === "OPEN") {
      data.resolver = { disconnect: true };
      data.resolvedAt = null;
      data.payer = { disconnect: true };
      data.paidAt = null;
    }

    if (status === "PAID") {
      data.payer = { connect: { id: actor.userId } };
      data.paidAt = new Date();
      if (!existing.resolverId) {
        data.resolver = { connect: { id: actor.userId } };
        data.resolvedAt = existing.resolvedAt ?? new Date();
      }
    }
  }

  await db.compensationRequest.update({
    where: { id },
    data,
  });

  revalidateCompensationPages(id, existing.playerIdentifier);
}
