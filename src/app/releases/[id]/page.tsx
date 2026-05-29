import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { formatIssueRef } from "@/lib/issue-ids";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { canManageReleases, getPermissionContext } from "@/lib/permissions";
import { linkIssueToRelease } from "@/app/staff-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  const canManage = canManageReleases(permissions);

  const release = await (db as any).release.findUnique({
    where: { id },
    include: {
      author: true,
      issues: {
        include: {
          issue: {
            select: { id: true, publicKey: true, title: true, status: true },
          },
        },
      },
    },
  });
  if (!release) notFound();

  const doneIssues = release.issues.filter((ri: any) => ri.issue.status === "DONE");

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title={release.name}
        description={`${release.status} · ${release.issues.length} linked issues`}
      />
      {release.description && (
        <Card>
          <CardBody>
            <MarkdownContent content={release.description} />
          </CardBody>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardBody>
            <form action={linkIssueToRelease} className="flex gap-2">
              <input type="hidden" name="releaseId" value={release.id} />
              <Input name="issueRef" placeholder="Issue key to link" className="flex-1" />
              <Button type="submit" size="sm" variant="primary">
                Link issue
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Linked issues</h3>
        {release.issues.map((ri: any) => {
          const ref = formatIssueRef(ri.issue.publicKey, ri.issue.id);
          return (
            <Link
              key={ri.id}
              href={`/issues/${ref}`}
              className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{ref}</span>{" "}
              {ri.issue.title} · {ri.issue.status}
            </Link>
          );
        })}
      </div>

      {doneIssues.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <h3 className="text-sm font-semibold">Changelog (done issues)</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {doneIssues.map((ri: any) => (
                <li key={ri.id}>{ri.issue.title}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageContainer>
  );
}
