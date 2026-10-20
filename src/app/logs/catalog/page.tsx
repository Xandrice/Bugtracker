import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { canAccessSettings, canUseAdvancedLogs, getPermissionContext } from "@/lib/permissions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { logEventCatalog } from "@/lib/log-service";
import { queryVictoriaLogs } from "@/lib/victorialogs";
import { EVENT_CATALOG } from "@/lib/log-events";
import { DataValue } from "@/components/staff/DataList";

export default async function LogCatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/logs/catalog");
  const permissions = await getPermissionContext(session.user.id);
  if (!canAccessSettings(permissions) || !canUseAdvancedLogs(permissions)) return <PageContainer><PageHeader title="Event catalog" description="Administrator and advanced log access are required." /></PageContainer>;
  const params = await searchParams; const page = Math.trunc(Math.max(1, Math.min(1000, Number(params.page) || 1)));
  const catalog = await logEventCatalog((page - 1) * 1000);
  const sample = params.resource !== undefined && params.event !== undefined ? await queryVictoriaLogs({ query: "* | sort by (_time) desc limit 1", start: "7d", end: "now", limit: 1, extraFilters: { resource: params.resource, event: params.event } }) : null;
  return <PageContainer><PageHeader title="Event catalog" description="Resource and event pairs observed over the last seven days. Select a pair to inspect a sample and confirm its wording." actions={<Link href="/logs">Back to logs</Link>} />
    {catalog.error && <p role="alert" className="text-danger">{catalog.error}</p>}
    {sample && <section className="mb-4 rounded border border-border p-4"><h2 className="mb-2 font-semibold">Sample: {params.resource} · {params.event}</h2>{sample.error ? <p role="alert">{sample.error}</p> : <DataValue value={sample.entries[0] || "No sample available."} />}</section>}
    <div className="overflow-auto rounded border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Resource", "Event", "Entries", "Category", "Wording", "Sample"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{catalog.pairs.map(pair => <tr key={`${pair.resource}:${pair.event}`} className="border-t border-border"><td className="p-3"><Link className="text-primary underline" href={`/logs/catalog?${new URLSearchParams({ resource: pair.resource, event: pair.event, page: String(page) })}`}>{pair.resource || "(missing)"}</Link></td><td className="p-3">{pair.event || "(missing)"}</td><td className="p-3 tabular-nums">{pair.hits}</td><td className="p-3">{pair.category}</td><td className="p-3">{EVENT_CATALOG[`${pair.resource}:${pair.event}`] ? "Friendly summary" : "Uses original message · needs review"}</td><td className="max-w-md p-3"><details><summary className="cursor-pointer text-primary">Inspect sample</summary><DataValue value={pair.sample || "No sample available."} /></details></td></tr>)}</tbody></table></div>
    {!catalog.error && !catalog.pairs.length && <p className="p-4 text-muted-foreground">No events observed in this range.</p>}
    <nav className="mt-4 flex gap-4" aria-label="Catalog pages">{page > 1 && <Link href={`/logs/catalog?page=${page - 1}`}>Previous</Link>}{catalog.pairs.length === 1000 && <Link href={`/logs/catalog?page=${page + 1}`}>Next 1,000 pairs</Link>}</nav>
  </PageContainer>;
}
