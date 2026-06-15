"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";

type Member = { discordId: string; name: string | null };

export function ReportSubjectFields({ members }: { members: Member[] }) {
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");

  const handleSelect = (value: string) => {
    if (!value) return;
    const match = members.find((m) => m.discordId === value);
    if (match) {
      setDiscordId(match.discordId);
      setName(match.name || "");
    }
  };

  return (
    <div className="space-y-3">
      {members.length > 0 && (
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            Pick a known member (optional)
          </label>
          <select
            defaultValue=""
            onChange={(e) => handleSelect(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-elevated px-2 text-xs"
          >
            <option value="">— Select a member —</option>
            {members.map((m) => (
              <option key={m.discordId} value={m.discordId}>
                {m.name || m.discordId}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            Member Discord ID
          </label>
          <Input
            name="subjectDiscordId"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 123456789012345678"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            Member name / tag
          </label>
          <Input
            name="subjectName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name or @username"
          />
        </div>
      </div>
    </div>
  );
}
