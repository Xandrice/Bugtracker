import { Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { createPlayerReport, getModLogMembers } from "@/app/staff-actions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ReportSubjectFields } from "./ReportSubjectFields";
import { discordSignInUrl } from "@/lib/auth-urls";

export default async function NewReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(discordSignInUrl("/reports/new"));

  const members = await getModLogMembers();

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="New mod-log entry"
        description="Record why a member spoke with staff or had an interaction worth tracking."
        icon={<Shield className="h-4 w-4" />}
      />
      <Card>
        <CardBody>
          <form action={createPlayerReport} className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Summary</label>
              <Input name="title" required placeholder="Short summary of what happened" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Details</label>
              <textarea
                name="description"
                placeholder="What happened, the context, and any outcome…"
                className="min-h-[120px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
              />
            </div>
            <ReportSubjectFields members={members} />
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Reporting staff / source (optional)
              </label>
              <Input name="reporterName" placeholder="Who flagged it or where it came from" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Category</label>
              <select
                name="category"
                defaultValue="CONDUCT"
                className="h-8 w-full rounded-md border border-input bg-elevated px-2 text-xs"
              >
                <option value="CONDUCT">Conduct</option>
                <option value="WARNING">Warning</option>
                <option value="TOXICITY">Toxicity</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="CHEATING">Cheating</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Evidence links (one per line)
              </label>
              <textarea
                name="evidenceLinks"
                placeholder="Screenshots, clips, Discord message links…"
                className="min-h-[80px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Save entry
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
