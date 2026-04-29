export const NOTE_THREAD_CATEGORIES = [
  { id: "GENERAL", label: "General" },
  { id: "DEV", label: "Development" },
  { id: "OPS", label: "Operations" },
  { id: "RELEASES", label: "Releases" },
  { id: "INCIDENTS", label: "Incidents" },
  { id: "IDEAS", label: "Ideas" },
] as const;

export type NoteThreadCategory = (typeof NOTE_THREAD_CATEGORIES)[number]["id"];

const NOTE_THREAD_CATEGORY_IDS = new Set(
  NOTE_THREAD_CATEGORIES.map((category) => category.id)
);

export function isNoteThreadCategory(value: string): value is NoteThreadCategory {
  return NOTE_THREAD_CATEGORY_IDS.has(value as NoteThreadCategory);
}

export function normalizeNoteThreadCategory(
  value: string | null | undefined
): NoteThreadCategory {
  const raw = (value || "").trim().toUpperCase();
  return isNoteThreadCategory(raw) ? raw : "GENERAL";
}

export function getNoteThreadCategoryLabel(value: string | null | undefined): string {
  const normalized = normalizeNoteThreadCategory(value);
  return (
    NOTE_THREAD_CATEGORIES.find((category) => category.id === normalized)?.label ||
    "General"
  );
}
