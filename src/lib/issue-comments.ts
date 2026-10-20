import { after } from "next/server";
import { db } from "./db";
import { syncIssueNotesFromDiscord } from "./discordSync";

export async function loadIssueComments(issueId: string, signedIn = false) {
  const notes = await db.note.findMany({ where: { issueId, ...(signedIn ? {} : { internal: false }) }, include: { author: true }, orderBy: { createdAt: "asc" } });
  after(async () => { try { await syncIssueNotesFromDiscord(issueId); } catch { console.error("Discord catch-up failed; stored comments are available."); } });
  return { notes, syncWarning: false };
}
