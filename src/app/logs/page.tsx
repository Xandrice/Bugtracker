import Link from "next/link";
import { auth } from "@/../auth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Section";
import { BookOpenText, Logs, ShieldAlert } from "lucide-react";
import { canViewLogs, getPermissionContext } from "@/lib/permissions";
import { isVictoriaLogsConfigured, queryVictoriaLogs } from "@/lib/victorialogs";

type LogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const RESERVED_FIELDS = new Set(["_time", "_msg"]);

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function parseLimit(rawLimit: string): number {
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(Math.max(parsed, 1), 1000);
}

function formatTime(raw: string | undefined): string {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function truncate(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <PageContainer>
        <PageHeader
          title="Logs"
          icon={<Logs className="h-4 w-4" />}
          description="Sign in to query your VictoriaLogs data."
        />
      </PageContainer>
    );
  }

  const permissionContext = await getPermissionContext(session.user.id);
  if (!canViewLogs(permissionContext)) {
    return (
      <PageContainer>
        <PageHeader
          title="Logs"
          icon={<Logs className="h-4 w-4" />}
          description="VictoriaLogs access is restricted to approved roles."
        />
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" />}
          title="Access denied"
          description="You do not have permission to view operational logs."
        />
      </PageContainer>
    );
  }

  const configured = isVictoriaLogsConfigured();
  const params = await searchParams;

  const query = readParam(params.q).trim() || "*";
  const start = readParam(params.start).trim() || "1h";
  const end = readParam(params.end).trim() || "now";
  const accountId = readParam(params.accountId).trim();
  const projectId = readParam(params.projectId).trim();
  const limit = parseLimit(readParam(params.limit).trim());

  const result = configured
    ? await queryVictoriaLogs({
        query,
        start,
        end,
        limit,
        accountId,
        projectId,
      })
    : null;

  return (
    <PageContainer>
      <PageHeader
        title="Logs"
        description="Search and inspect events from VictoriaLogs."
        icon={<Logs className="h-4 w-4" />}
        actions={
          <Link
            href="https://docs.victoriametrics.com/victorialogs/querying/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 h-8 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BookOpenText className="h-3.5 w-3.5" />
            Query docs
          </Link>
        }
      />

      {!configured ? (
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" />}
          title="VictoriaLogs is not configured"
          description="Set VICTORIALOGS_URL (and optional auth/tenant env vars) so this panel can query your logs backend."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Query builder</CardTitle>
                <CardDescription>
                  Use LogsQL in <code>q</code>. Time range accepts absolute or relative values (for
                  example, <code>1h</code> to <code>now</code>).
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="space-y-1 md:col-span-2 xl:col-span-3">
                  <Label htmlFor="q">LogsQL query</Label>
                  <Input id="q" name="q" defaultValue={query} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="start">Start</Label>
                  <Input id="start" name="start" defaultValue={start} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end">End</Label>
                  <Input id="end" name="end" defaultValue={end} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="limit">Limit</Label>
                  <Input
                    id="limit"
                    name="limit"
                    type="number"
                    min={1}
                    max={1000}
                    defaultValue={String(limit)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="accountId">AccountID (optional)</Label>
                  <Input
                    id="accountId"
                    name="accountId"
                    defaultValue={accountId}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="projectId">ProjectID (optional)</Label>
                  <Input
                    id="projectId"
                    name="projectId"
                    defaultValue={projectId}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="md:col-span-2 xl:col-span-6">
                  <Button type="submit" variant="primary" size="sm">
                    Run query
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {result?.error
                    ? "The query failed. Check connection, credentials, and query syntax."
                    : `Showing ${result?.entries.length || 0} entries.`}
                  {result?.requestDurationSeconds
                    ? ` Query duration: ${result.requestDurationSeconds}s.`
                    : ""}
                  {result?.accountId || result?.projectId
                    ? ` Tenant: ${result.accountId ?? "0"}:${result.projectId ?? "0"}.`
                    : ""}
                  {result?.skippedLines
                    ? ` Skipped ${result.skippedLines} malformed rows.`
                    : ""}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {result?.error ? (
                <div className="px-4 py-3 text-xs text-danger">{result.error}</div>
              ) : (result?.entries.length || 0) === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No logs matched this query.
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                      <tr>
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2">Message</th>
                        <th className="px-4 py-2">Fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result?.entries.map((entry, idx) => {
                        const fields = Object.entries(entry).filter(
                          ([fieldName]) => !RESERVED_FIELDS.has(fieldName)
                        );

                        return (
                          <tr
                            key={`${entry._time || "no-time"}-${idx}`}
                            className="border-b border-border align-top hover:bg-muted/40"
                          >
                            <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {formatTime(entry._time)}
                            </td>
                            <td className="px-4 py-2 text-xs text-foreground whitespace-pre-wrap break-words">
                              {entry._msg || "—"}
                            </td>
                            <td className="px-4 py-2">
                              {fields.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {fields.slice(0, 8).map(([fieldName, fieldValue]) => (
                                    <span
                                      key={`${idx}-${fieldName}`}
                                      className="inline-flex max-w-[360px] items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                                      title={fieldValue}
                                    >
                                      {fieldName}={truncate(fieldValue, 80)}
                                    </span>
                                  ))}
                                  {fields.length > 8 && (
                                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-subtle-foreground">
                                      +{fields.length - 8} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
