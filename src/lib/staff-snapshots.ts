import "server-only";

import { db } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/fivem-db";

export type MetricHistoryPoint = {
  capturedAt: string;
  totalPlayers: number;
  totalCash: number;
  totalBank: number;
  totalMoney: number;
  totalVehicles: number;
};

// Computes the current metrics and persists a snapshot row for trend charts.
export async function captureMetricSnapshot(): Promise<{ ok: boolean; error?: string }> {
  try {
    const metrics = await getDashboardMetrics();
    if (!metrics.configured) {
      return { ok: false, error: "FiveM database is not configured." };
    }
    if (metrics.connectionError) {
      return { ok: false, error: metrics.connectionError };
    }

    await (db as { metricSnapshot: { create: (args: unknown) => Promise<unknown> } }).metricSnapshot.create({
      data: {
        totalPlayers: metrics.players.total,
        totalCash: metrics.economy.totalCash,
        totalBank: metrics.economy.totalBank,
        totalMoney: metrics.economy.total,
        totalVehicles: metrics.vehicles.total,
        data: metrics as unknown as object,
      },
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to capture snapshot.",
    };
  }
}

// Reads recent snapshots for trend charts. Returns an empty series if the
// history table does not exist yet (migration not applied) or on any error.
export async function getMetricHistory(days = 30): Promise<MetricHistoryPoint[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await (
      db as {
        metricSnapshot: {
          findMany: (args: unknown) => Promise<
            Array<{
              capturedAt: Date;
              totalPlayers: number;
              totalCash: number;
              totalBank: number;
              totalMoney: number;
              totalVehicles: number;
            }>
          >;
        };
      }
    ).metricSnapshot.findMany({
      where: { capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
      select: {
        capturedAt: true,
        totalPlayers: true,
        totalCash: true,
        totalBank: true,
        totalMoney: true,
        totalVehicles: true,
      },
    });

    return rows.map((row) => ({
      capturedAt: row.capturedAt.toISOString(),
      totalPlayers: row.totalPlayers,
      totalCash: row.totalCash,
      totalBank: row.totalBank,
      totalMoney: row.totalMoney,
      totalVehicles: row.totalVehicles,
    }));
  } catch {
    return [];
  }
}

export async function getLatestSnapshotTime(): Promise<string | null> {
  try {
    const row = await (
      db as {
        metricSnapshot: {
          findFirst: (args: unknown) => Promise<{ capturedAt: Date } | null>;
        };
      }
    ).metricSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    return row ? row.capturedAt.toISOString() : null;
  } catch {
    return null;
  }
}
