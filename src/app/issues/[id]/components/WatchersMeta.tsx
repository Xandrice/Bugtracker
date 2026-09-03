import { Eye, EyeOff } from "lucide-react";
import { toggleIssueWatch } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Section";

export type WatcherRow = {
    id: string;
    name: string | null;
    image: string | null;
};

const MAX_AVATARS = 8;

export function WatchersMeta({
    issueId,
    watchers,
    currentUserId,
}: {
    issueId: string;
    watchers: WatcherRow[];
    currentUserId: string | null;
}) {
    const watching = !!currentUserId && watchers.some((watcher) => watcher.id === currentUserId);
    const shown = watchers.slice(0, MAX_AVATARS);
    const extra = watchers.length - shown.length;

    return (
        <Meta label={`Watchers · ${watchers.length}`}>
            <div className="flex items-center justify-between gap-2">
                {watchers.length === 0 ? (
                    <span className="text-sm text-subtle-foreground">None</span>
                ) : (
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {shown.map((watcher) => (
                            <span
                                key={watcher.id}
                                title={watcher.name || "Watcher"}
                                className="inline-flex"
                            >
                                <Avatar src={watcher.image} name={watcher.name} size="xs" />
                            </span>
                        ))}
                        {extra > 0 && (
                            <span className="text-[11px] text-muted-foreground">+{extra}</span>
                        )}
                    </div>
                )}
                {currentUserId && (
                    <form action={toggleIssueWatch}>
                        <input type="hidden" name="issueId" value={issueId} />
                        <input type="hidden" name="watch" value={watching ? "false" : "true"} />
                        <Button
                            type="submit"
                            size="xs"
                            variant={watching ? "outline" : "secondary"}
                            aria-label={watching ? "Unwatch this issue" : "Watch this issue"}
                        >
                            {watching ? (
                                <EyeOff className="h-3 w-3" />
                            ) : (
                                <Eye className="h-3 w-3" />
                            )}
                            {watching ? "Unwatch" : "Watch"}
                        </Button>
                    </form>
                )}
            </div>
        </Meta>
    );
}
