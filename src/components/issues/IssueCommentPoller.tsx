"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function IssueCommentPoller() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => {
      const editing = document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement;
      if (!document.hidden && !editing) router.refresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [router]);
  return null;
}
