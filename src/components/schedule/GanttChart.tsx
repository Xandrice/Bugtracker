"use client";

import { useRef, useState, useTransition, type PointerEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { CategoryTags } from "./Categories";
import { addCalendarDays, categoryTextColor, daysBetween, formatRoadmapDate, type GanttItem } from "@/lib/roadmap";
import { moveScheduleItem } from "@/app/roadmap/schedule-actions";

type Mode = "move" | "start" | "end";
type Preview = { key: string; start: string; end: string };
function shifted(item: GanttItem, mode: Mode, delta: number): Preview {
  if (mode === "move") delta = Math.max(daysBetween(item.start, "1900-01-01"), Math.min(delta, daysBetween(item.end, "9999-12-31")));
  return { key: `${item.kind}:${item.id}`,
    start: mode === "end" ? item.start : addCalendarDays(item.start, mode === "start" ? Math.min(delta, daysBetween(item.start, item.end)) : delta),
    end: mode === "start" ? item.end : addCalendarDays(item.end, mode === "end" ? Math.max(delta, -daysBetween(item.start, item.end)) : delta),
  };
}

export function GanttChart({ items, today, canManage, canEditTasks, onOpen, originalStart }: { items: GanttItem[]; today: string; canManage: boolean; canEditTasks: boolean; onOpen: (item: GanttItem) => void; originalStart: (item: GanttItem) => string | null }) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const scroll = useRef<HTMLDivElement>(null);
  const drag = useRef<{ item: GanttItem; mode: Mode; x: number; width: number; scrollLeft: number; delta: number } | null>(null);
  const suppressClick = useRef(false);
  const start = addCalendarDays(today, offset);
  const days = Array.from({ length: 28 }, (_, index) => addCalendarDays(start, index));
  const end = days[27];
  const visible = items.filter(item => item.start <= end && item.end >= start);
  function commit(item: GanttItem, next: Preview) {
    if (item.start === next.start && item.end === next.end) { setPreview(null); return; }
    setError(""); setMessage(""); setPreview(next);
    startTransition(async () => {
      try {
        const result = await moveScheduleItem({ kind: item.kind, id: item.id, start: next.start, end: next.end, previousStart: originalStart(item), previousEnd: item.end });
        if (result.error) setError(result.error);
        else { setMessage(`${item.name}: ${formatRoadmapDate(next.start)} - ${formatRoadmapDate(next.end)} saved.`); router.refresh(); }
      } catch { setError("Could not save dates. The original schedule has been restored."); }
      finally { setPreview(null); }
    });
  }
  function begin(event: PointerEvent<HTMLButtonElement>, item: GanttItem, mode: Mode) {
    if (pending || event.button !== 0 || !(item.kind === "RELEASE" ? canManage : canEditTasks)) return;
    const track = event.currentTarget.closest("[data-gantt-track]");
    if (!track) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { item, mode, x: event.clientX, width: track.getBoundingClientRect().width, scrollLeft: scroll.current?.scrollLeft ?? 0, delta: 0 };
    suppressClick.current = false;
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const distance = event.clientX - current.x + (scroll.current?.scrollLeft ?? 0) - current.scrollLeft;
    if (Math.abs(distance) > 4) suppressClick.current = true;
    current.delta = Math.round(distance / (current.width / 28));
    setPreview(shifted(current.item, current.mode, current.delta));
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (suppressClick.current) commit(current.item, shifted(current.item, current.mode, current.delta));
    else setPreview(null);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, item: GanttItem, mode: Mode) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    commit(item, shifted(item, mode, event.key === "ArrowRight" ? 1 : -1));
  }
  const interactions = (item: GanttItem, mode: Mode) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => begin(event, item, mode), onPointerMove: move, onPointerUp: finish,
    onPointerCancel: () => { drag.current = null; suppressClick.current = false; setPreview(null); },
    onLostPointerCapture: () => { if (drag.current) { drag.current = null; setPreview(null); } },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => keyboard(event, item, mode),
  });
  return <section aria-label="Four-week Gantt chart" className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3"><div className="flex items-center gap-2"><Button aria-label="Previous week" size="icon" disabled={pending} onClick={() => setOffset(offset - 7)}><ChevronLeft className="h-4 w-4" /></Button><h2 className="text-sm font-semibold">{formatRoadmapDate(start)} - {formatRoadmapDate(end)}</h2><Button aria-label="Next week" size="icon" disabled={pending} onClick={() => setOffset(offset + 7)}><ChevronRight className="h-4 w-4" /></Button></div><Button disabled={pending} onClick={() => setOffset(0)}>Today</Button></div>
    <p id="gantt-help" className="p-3 text-xs text-muted-foreground">28 rolling days. Drag a bar to move it; drag an edge to resize. Focus a bar or edge and use the arrow keys to adjust by one day. Select a title to edit dates and categories. <span className="sm:hidden">Scroll sideways to see all four weeks.</span></p>
    {error && <p role="alert" className="px-3 pb-3 text-sm text-danger">{error}</p>}<p role="status" className="px-3 text-xs text-success">{pending ? "Saving dates..." : message}</p>
    <div ref={scroll} className="overflow-x-auto"><div className="min-w-[1160px]">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: "240px 1fr" }}><div className="border-r border-border p-3 text-xs font-semibold">Scheduled work</div><div><div className="grid grid-cols-4 border-b border-border">{[0, 7, 14, 21].map(index => <div key={index} className="border-r border-border px-2 py-1 text-[10px] font-medium">{formatRoadmapDate(days[index], { month: "short", day: "numeric" })} - {formatRoadmapDate(days[index + 6], { month: "short", day: "numeric" })}</div>)}</div><div className="grid" style={{ gridTemplateColumns: "repeat(28, minmax(0, 1fr))" }}>{days.map(day => <div key={day} data-gantt-day={day} aria-label={day} className={cn("border-r border-border py-2 text-center text-[10px]", day === today && "bg-primary/15 font-bold text-primary")}><div>{formatRoadmapDate(day, { weekday: "narrow" })}</div>{Number(day.slice(-2))}</div>)}</div></div></div>
      {visible.map(item => {
        const key = `${item.kind}:${item.id}`;
        const dates = preview?.key === key ? preview : item;
        const barStart = Math.max(0, daysBetween(start, dates.start));
        const barEnd = Math.min(28, daysBetween(start, dates.end) + 1);
        const editable = item.kind === "RELEASE" ? canManage : canEditTasks;
        const color = item.categories[0]?.color ?? "#4363D8";
        return <div key={key} data-gantt-item={key} className="grid min-h-20 border-b border-border" style={{ gridTemplateColumns: "240px 1fr" }}>
          <div className="space-y-1 border-r border-border p-3"><button className="block w-full truncate text-left text-xs font-medium hover:text-primary focus-ring" onClick={() => onOpen(item)} title={item.name}>{item.name}</button><p className="text-[10px] text-muted-foreground">{item.kind === "ISSUE" ? "Board task" : "Roadmap event"}</p><CategoryTags categories={item.categories} /></div>
          <div data-gantt-track className="relative min-h-20" style={{ backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px)", backgroundSize: `${100 / 28}% 100%` }}>
            {barEnd > barStart && <div className="absolute top-5 flex h-9 items-stretch overflow-hidden rounded border border-black/30 shadow-sm" style={{ left: `${barStart / 28 * 100}%`, width: `${(barEnd - barStart) / 28 * 100}%`, backgroundColor: color, color: categoryTextColor(color) }}>
              {editable && dates.start >= start && <button type="button" disabled={pending} aria-label={`Resize start of ${item.name}`} aria-describedby="gantt-help" title="Drag to change start date" className="w-2 shrink-0 touch-none cursor-ew-resize border-r border-current/30 focus-ring" {...interactions(item, "start")} />}
              <button type="button" disabled={pending} aria-label={`${item.name}: ${dates.start} to ${dates.end}`} aria-describedby="gantt-help" title={`${item.name}: ${dates.start} - ${dates.end}${editable ? " - Drag to move" : ""}`} className={cn("min-w-0 flex-1 truncate px-1 text-left text-[10px] font-medium focus-ring", editable && "touch-none cursor-grab active:cursor-grabbing")} {...(editable ? interactions(item, "move") : {})} onClick={event => { if (suppressClick.current) { event.preventDefault(); suppressClick.current = false; } else onOpen(item); }}>{item.name}</button>
              {editable && dates.end <= end && <button type="button" disabled={pending} aria-label={`Resize end of ${item.name}`} aria-describedby="gantt-help" title="Drag to change end date" className="w-2 shrink-0 touch-none cursor-ew-resize border-l border-current/30 focus-ring" {...interactions(item, "end")} />}
            </div>}
          </div>
        </div>;
      })}
      {!visible.length && <p className="p-8 text-sm text-muted-foreground">No scheduled work in these four weeks. Set a start and due date on a board task, or add a dated roadmap event.</p>}
    </div></div>
  </section>;
}
