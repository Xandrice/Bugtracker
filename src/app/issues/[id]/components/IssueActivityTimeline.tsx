import { Clock, History } from "lucide-react";
import { db } from "@/lib/db";
import { formatActivityLabel } from "@/lib/activity";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/Section";

export async function IssueActivityTimeline({ issueId }: { issueId: string }) {
  const activities = await (db as any).issueActivity.findMany({
    where: { issueId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-5 w-5" />}
        title="No activity recorded yet"
        description="Status, assignee, and field changes will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity: any) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
        >
          <Avatar
            src={activity.actor?.image}
            name={activity.actor?.name}
            size="sm"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {activity.actor?.name || "Someone"}
              </span>{" "}
              <span className="text-muted-foreground">
                {formatActivityLabel(activity)}
              </span>
            </p>
            <p className="flex items-center gap-1 text-[11px] text-subtle-foreground">
              <Clock className="h-3 w-3" />
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(activity.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
