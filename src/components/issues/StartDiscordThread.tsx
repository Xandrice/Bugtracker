"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startIssueDiscordThread } from "@/app/issues/discord-actions";
import { Button } from "@/components/ui/Button";
export function StartDiscordThread({ issueId }: { issueId: string }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  return <div><Button disabled={pending} onClick={async () => { setPending(true); setError(""); try { await startIssueDiscordThread(issueId); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the thread."); } finally { setPending(false); } }}>{pending ? "Starting thread…" : "Start Discord thread"}</Button>{error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}</div>;
}
