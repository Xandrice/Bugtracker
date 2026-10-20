import { auth } from "@/../auth";
import { getPermissionContext } from "@/lib/permissions";
import { exportLogs } from "@/lib/log-service";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Sign in required" }, { status: 401 });
  const permissions = await getPermissionContext(session.user.id);
  try {
    const csv = await exportLogs(Object.fromEntries(new URL(request.url).searchParams), permissions);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tracker-logs.csv", "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not export logs." }, { status: 400 }); }
}
