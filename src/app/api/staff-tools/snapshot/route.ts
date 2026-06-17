import { NextResponse } from "next/server";
import { captureMetricSnapshot } from "@/lib/staff-snapshots";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json). When CRON_SECRET is set, Vercel
// sends it as a Bearer token and we reject any request without it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await captureMetricSnapshot();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
