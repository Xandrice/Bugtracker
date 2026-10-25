"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveTaskSchedule } from "@/app/roadmap/schedule-actions";
import { Button } from "@/components/ui/Button";
import { FieldRow, Input } from "@/components/ui/Input";
import { CategoryPicker, CategoryTags } from "./Categories";
import type { ScheduleCategory } from "@/lib/roadmap";

export function TaskScheduleForm({ id, startDate, dueDate, selected, categories, onSaved }: { id: string; startDate: string; dueDate: string; selected: ScheduleCategory[]; categories: ScheduleCategory[]; onSaved?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await saveTaskSchedule(form);
        if (result.error) { setError(result.error); return; }
        setMessage("Schedule saved."); router.refresh(); onSaved?.();
      } catch { setError("Could not save schedule. Your changes are still here; try again."); }
    });
  }
  return <form onSubmit={save} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
    <input type="hidden" name="id" value={id} />
    <div className="grid gap-3 sm:grid-cols-2"><FieldRow label="Start date" htmlFor={`task-start-${id}`}><Input className="border-border-strong bg-background" id={`task-start-${id}`} name="startDate" type="date" min="1900-01-01" max="9999-12-31" defaultValue={startDate} /></FieldRow><FieldRow label="Due date" htmlFor={`task-end-${id}`}><Input className="border-border-strong bg-background" id={`task-end-${id}`} name="dueDate" type="date" min="1900-01-01" max="9999-12-31" defaultValue={dueDate} /></FieldRow></div>
    <p className="text-xs text-muted-foreground">Set both dates to include this task on the Gantt chart.</p>
    <CategoryPicker categories={categories} selected={selected} />
    <Button type="submit" variant="primary" loading={pending}>Save schedule</Button>
  </fieldset>{error && <p role="alert" className="text-sm text-danger">{error}</p>}{message && <p role="status" className="text-xs text-success">{message}</p>}</form>;
}

export function IssueSchedule({ id, startDate, dueDate, selected, categories, canEdit }: { id: string; startDate: string; dueDate: string; selected: ScheduleCategory[]; categories: ScheduleCategory[]; canEdit: boolean }) {
  return <section className="space-y-3 rounded-md border border-border bg-surface p-4"><h2 className="text-sm font-semibold">Schedule & categories</h2><CategoryTags categories={selected} />{canEdit ? <TaskScheduleForm key={`${id}:${startDate}:${dueDate}:${selected.map(c => c.id).join(",")}`} id={id} startDate={startDate} dueDate={dueDate} selected={selected} categories={categories} /> : <p className="text-xs text-muted-foreground">{startDate || "No start date"} - {dueDate || "No due date"}</p>}</section>;
}
