import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { authorizeDiscordWebhook } from "@/lib/discord-intake";
import {
  LIVE_MAP_STALE_AFTER_MS,
  applyLiveMapIngest,
  getLiveMapSnapshot,
  parseLiveMapIngest,
} from "@/lib/live-map";
import { canViewStaffPlayers, getPermissionContext } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getPermissionContext(session.user.id);
  if (!canViewStaffPlayers(permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(getLiveMapSnapshot());
}

export async function POST(req: Request) {
  const authError = authorizeDiscordWebhook(req);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseLiveMapIngest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = applyLiveMapIngest(parsed.value);
  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    rejected: result.rejected,
    staleAfterMs: LIVE_MAP_STALE_AFTER_MS,
  });
}
