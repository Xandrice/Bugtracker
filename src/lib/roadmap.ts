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
