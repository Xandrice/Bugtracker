import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { canAccessSettings, canUseAdvancedLogs, canViewLogs, canViewStaffPlayers, getPermissionContext } from "@/lib/permissions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { LogExplorer } from "@/components/logs/LogExplorer";
import type { PlayerLogParams } from "@/lib/player-logs";

export default async function LogsPage({ searchParams }: { searchParams: Promise<PlayerLogParams> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/logs");
  const permissions = await getPermissionContext(session.user.id);
  if (!canViewLogs(permissions)) return <PageContainer><PageHeader title="Logs" description="Your role does not have permission to view logs." /></PageContainer>;
  return <PageContainer className="max-w-[1500px]"><PageHeader title="Logs" description="Follow player activity, investigate events, and share evidence." actions={canAccessSettings(permissions) ? <Link href="/logs/catalog" className="text-sm text-primary underline">Event catalog</Link> : undefined} /><LogExplorer params={await searchParams} advanced={canUseAdvancedLogs(permissions)} players={canViewStaffPlayers(permissions)} /></PageContainer>;
}
