import Link from "next/link";
import { Clock, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  formatStaffAuditAction,
  staffAuditTargetHref,
  staffAuditTargetLabel,
  type StaffAuditEventView,
} from "@/lib/staff-audit";
import { formatRelativeTime } from "@/lib/time";

function actionTone(action: string): "danger" | "success" | "warning" | "info" | "neutral" {
  switch (action) {
    case "TOGGLE_BAN":
      return "danger";
    case "TOGGLE_WHITELIST":
      return "success";
    case "TOGGLE_STORAGE":
      return "warning";
    case "PUT_AWAY":
      return "info";
    default:
      return "neutral";
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case "TOGGLE_BAN":
      return "Ban";
    case "TOGGLE_WHITELIST":
      return "Whitelist";
    case "TOGGLE_STORAGE":
      return "Storage";
    case "PUT_AWAY":
      return "Garage";
    default:
      return action.replace(/_/g, " ");
  }
}

function changeLabel(oldValue: string | null, newValue: string | null): string | null {
  if (oldValue == null && newValue == null) return null;
  return `${oldValue ?? "—"} → ${newValue ?? "—"}`;
}

export function StaffAuditList({
  events,
  emptyLabel = "No staff writes recorded yet.",
  showTarget = false,
}: {
  events: StaffAuditEventView[];
  emptyLabel?: string;
  showTarget?: boolean;
}) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const targetHref = showTarget ? staffAuditTargetHref(event) : null;
        const target = showTarget ? staffAuditTargetLabel(event) : null;
        const change = changeLabel(event.oldValue, event.newValue);

        return (
          <div
            key={event.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={actionTone(event.action)} size="xs">
                  {actionLabel(event.action)}
                </Badge>
                {target &&
                  (targetHref ? (
                    <Link
                      href={targetHref}
                      className="font-mono text-[11px] text-foreground hover:underline"
                    >
                      {target}
                    </Link>
                  ) : (
                    <span className="font-mono text-[11px] text-foreground">{target}</span>
                  ))}
              </div>
              <p className="text-sm text-foreground">
                <span className="font-medium">{event.actorName}</span>{" "}
                <span className="text-muted-foreground">{formatStaffAuditAction(event)}</span>
              </p>
              {change && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {event.field}: {change}
                </p>
              )}
            </div>
            <p className="flex shrink-0 items-center gap-1 text-[11px] text-subtle-foreground">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(event.createdAt)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
