"use server";

import { auth } from "@/../auth";
import { getIssueChildren } from "@/lib/issue-list";
import { parseIssueListState, type IssueListScope, type IssueListParams } from "@/lib/issue-list-state";

export async function loadIssueChildren(parentId: string, params: IssueListParams, scope: IssueListScope, offset: number) {
  if (!["all", "triage", "assigned", "watching"].includes(scope) || typeof parentId !== "string" || !Number.isSafeInteger(offset) || offset < 0) return { error: "Invalid request." };
  const session = await auth();
  if ((scope === "assigned" || scope === "watching") && !session?.user?.id) return { error: "Sign in to load your issues." };
  return { rows: await getIssueChildren(parentId, parseIssueListState(params, scope), scope, session?.user?.id ?? null, offset) };
}
