import { Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { createPlayerReport } from "@/app/staff-actions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function NewReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/reports/new");

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title="New player report" icon={<Shield className="h-4 w-4" />} />
      <Card>
        <CardBody>
          <form action={createPlayerReport} className="space-y-4">
            <Input name="title" required placeholder="Report summary" />
            <textarea
              name="description"
              placeholder="Details and context…"
              className="min-h-[120px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
            />
            <Input name="reporterName" placeholder="Reporting player (optional)" />
            <Input name="accusedPlayer" placeholder="Accused player ID / name" />
            <select
              name="category"
              defaultValue="CONDUCT"
              className="h-8 w-full rounded-md border border-input bg-elevated px-2 text-xs"
            >
              <option value="CONDUCT">Conduct</option>
              <option value="CHEATING">Cheating</option>
              <option value="HARASSMENT">Harassment</option>
              <option value="OTHER">Other</option>
            </select>
            <textarea
              name="evidenceLinks"
              placeholder="Evidence links (one per line)"
              className="min-h-[80px] w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm focus-ring"
            />
            <Button type="submit" variant="primary" size="sm">
              Submit report
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
