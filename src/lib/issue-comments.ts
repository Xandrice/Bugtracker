import { db } from "./db";
import { syncIssueNotesFromDiscord } from "./discordSync";

export async function loadIssueComments(issueId: string) {
  let syncWarning = false;
  try {
    const sync = await syncIssueNotesFromDiscord(issueId);
    syncWarning = sync.reason === "discord-fetch-failed";
  } catch (error) {
    console.error("Failed to sync Discord notes for issue", issueId, error);
    syncWarning = true;
  }
  const notes = await db.note.findMany({ where: { issueId }, include: { author: true }, orderBy: { createdAt: "asc" } });
  return { notes, syncWarning };
}
