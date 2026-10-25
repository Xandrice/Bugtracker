export const ROADMAP_STATUSES = ["PLANNED", "IN_PROGRESS", "RELEASED"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];
export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  RELEASED: "Completed",
};

export type RoadmapIssue = { id: string; publicKey: string | null; title: string; status: string };
export type RoadmapMilestone = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  startDate?: string | null;
  categories?: ScheduleCategory[];
  issues: RoadmapIssue[];
};

// Date inputs and milestones represent calendar days, stored at midnight UTC.
export function parseRoadmapDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "9999-12-31") return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function calendarDays(month: string): string[] {
  const first = parseRoadmapDate(`${month}-01`);
  if (!first) return [];
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const count = Math.ceil((first.getUTCDay() + last.getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

export function moveMonth(month: string, delta: number): string {
  const date = parseRoadmapDate(`${month}-01`);
  if (!date) return month;
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0, 7) : month;
}

export function formatRoadmapDate(day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

export type ScheduleCategory = { id: string; name: string; color: string };
export type ScheduledTask = RoadmapIssue & { startDate: string; dueDate: string; categories: ScheduleCategory[] };
export type GanttItem = { id: string; kind: "ISSUE" | "RELEASE"; name: string; status: string; start: string; end: string; categories: ScheduleCategory[] };

// Deliberately varied hues and lightness; labels also identify every category.
export const CATEGORY_COLORS = [
  ["Red", "#E6194B"], ["Green", "#3CB44B"], ["Yellow", "#FFE119"], ["Blue", "#4363D8"],
  ["Orange", "#F58231"], ["Purple", "#911EB4"], ["Cyan", "#42D4F4"], ["Magenta", "#F032E6"],
  ["Lime", "#BFEF45"], ["Pink", "#FABED4"], ["Teal", "#008080"], ["Lavender", "#DCBEFF"],
  ["Brown", "#9A6324"], ["Cream", "#FFFAC8"], ["Maroon", "#800000"], ["Mint", "#AAFFC3"],
  ["Olive", "#808000"], ["Apricot", "#FFD8B1"], ["Navy", "#000075"], ["Gray", "#808080"],
] as const;

export function categoryTextColor(hex: string): string {
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? "#000000" : "#FFFFFF";
}

export function addCalendarDays(day: string, delta: number): string {
  const date = parseRoadmapDate(day);
  if (!date || !Number.isInteger(delta)) return day;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0, 10) : day;
}

export function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
}

export function ganttItems(milestones: RoadmapMilestone[], tasks: ScheduledTask[]): GanttItem[] {
  return [
    ...milestones.filter(item => item.targetDate && (!item.startDate || item.startDate <= item.targetDate)).map(item => ({
      id: item.id, kind: "RELEASE" as const, name: item.name, status: item.status,
      start: item.startDate || item.targetDate!, end: item.targetDate!, categories: item.categories ?? [],
    })),
    ...tasks.filter(item => parseRoadmapDate(item.startDate) && parseRoadmapDate(item.dueDate) && item.startDate <= item.dueDate).map(item => ({
      id: item.id, kind: "ISSUE" as const, name: item.publicKey ? `${item.publicKey} - ${item.title}` : item.title,
      status: item.status, start: item.startDate, end: item.dueDate, categories: item.categories,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}
