"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldRow, Input } from "@/components/ui/Input";
import { CATEGORY_COLORS, categoryTextColor, type ScheduleCategory } from "@/lib/roadmap";
import { saveScheduleCategory, deleteScheduleCategory } from "@/app/roadmap/schedule-actions";

export function CategoryTags({ categories }: { categories: ScheduleCategory[] }) {
  return <span className="flex min-w-0 max-w-full flex-wrap gap-1">{categories.map(category => <span key={category.id} className="inline-flex max-w-full items-center gap-1 rounded border border-black/20 px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: category.color, color: categoryTextColor(category.color) }}><span className="truncate">{category.name}</span></span>)}</span>;
}

export function CategoryPicker({ categories, selected = [] }: { categories: ScheduleCategory[]; selected?: ScheduleCategory[] }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-xs font-medium">Categories</legend>
    {categories.length ? <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{categories.map(category => <label key={category.id} className="flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-xs"><input type="checkbox" name="categoryId" value={category.id} defaultChecked={selected.some(item => item.id === category.id)} /><CategoryTags categories={[category]} /></label>)}</div> : <p className="text-xs text-muted-foreground">No categories yet. A roadmap manager can add them with Manage categories.</p>}
  </fieldset>;
}

export function CategoryManager({ categories, onClose }: { categories: ScheduleCategory[]; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<ScheduleCategory | null>(null);
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0][1]);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { dialog.current?.showModal(); }, []);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveScheduleCategory(form);
        if (result.error) { setError(result.error); return; }
        element.reset(); setEditing(null); setColor(CATEGORY_COLORS[0][1]); router.refresh();
      } catch { setError("Could not save category. Try again."); }
    });
  }
  function remove(id: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteScheduleCategory(id);
        if (result.error) { setError(result.error); return; }
        setDeleting(null); if (editing?.id === id) setEditing(null); router.refresh();
      } catch { setError("Could not delete category. Try again."); }
    });
  }
  return <dialog ref={dialog} aria-labelledby="categories-title" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-lg border border-border bg-elevated p-5 text-foreground shadow-xl backdrop:bg-black/50">
    <div className="mb-4 flex items-center justify-between gap-2"><h2 id="categories-title" className="font-semibold">Manage categories</h2><Button disabled={pending} onClick={onClose}>Close</Button></div>
    <p className="mb-4 text-xs text-muted-foreground">Shared across the calendar, roadmap list, and Gantt. Rename or recolor a category to update all its tags.</p>
    <ul className="mb-4 space-y-2">{categories.map(category => <li key={category.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2"><CategoryTags categories={[category]} /><Button size="sm" aria-label={`Edit ${category.name}`} disabled={pending} onClick={() => { setEditing(category); setColor(category.color); setDeleting(null); }}>Edit</Button><Button size="sm" aria-label={`Delete ${category.name}`} disabled={pending} onClick={() => setDeleting(category.id)}>Delete</Button>{deleting === category.id && <div className="w-full space-y-2 text-xs"><p>Remove this category from all events and tasks? Events and tasks will be kept.</p><Button variant="danger" disabled={pending} onClick={() => remove(category.id)}>Confirm remove category</Button><Button disabled={pending} onClick={() => setDeleting(null)}>Keep category</Button></div>}</li>)}</ul>
    <form key={editing?.id ?? "new"} onSubmit={save} className="space-y-4 border-t border-border pt-4">
      <fieldset disabled={pending} className="space-y-4">
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <FieldRow label="Category name" htmlFor="category-name"><Input className="border-border-strong bg-background" placeholder="e.g. Engineering" id="category-name" name="name" required maxLength={60} defaultValue={editing?.name ?? ""} /></FieldRow>
        <fieldset><legend className="mb-2 text-xs font-medium">20 preset colors</legend><div className="grid grid-cols-10 gap-2">{CATEGORY_COLORS.map(([name, hex]) => <button type="button" key={hex} aria-label={`${name} ${hex}`} title={`${name} ${hex}`} aria-pressed={color.toUpperCase() === hex} onClick={() => setColor(hex)} className="h-7 min-w-0 rounded border border-foreground/30 focus-ring" style={{ backgroundColor: hex, color: categoryTextColor(hex) }}>{color.toUpperCase() === hex ? "\u2713" : ""}</button>)}</div></fieldset>
        <div className="flex items-end gap-3"><FieldRow label="Custom color" htmlFor="category-color-picker"><input id="category-color-picker" type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"} onChange={event => setColor(event.target.value)} className="h-9 w-14 cursor-pointer" /></FieldRow><FieldRow label="Hex color" htmlFor="category-color"><Input className="border-border-strong bg-background" id="category-color" name="color" value={color} onChange={event => setColor(event.target.value)} pattern="#[0-9a-fA-F]{6}" required maxLength={7} /></FieldRow></div>
        <div className="flex gap-2"><Button type="submit" variant="primary" loading={pending}>{editing ? "Save category" : "Add category"}</Button>{editing && <Button type="button" onClick={() => { setEditing(null); setColor(CATEGORY_COLORS[0][1]); }}>Cancel edit</Button>}</div>
      </fieldset>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </dialog>;
}
