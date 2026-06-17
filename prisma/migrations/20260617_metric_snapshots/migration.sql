-- Historical snapshots of FiveM server metrics for the analytics dashboard.
CREATE TABLE IF NOT EXISTS "MetricSnapshot" (
  "id"            TEXT NOT NULL,
  "capturedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalPlayers"  INTEGER NOT NULL DEFAULT 0,
  "totalCash"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalBank"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalMoney"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalVehicles" INTEGER NOT NULL DEFAULT 0,
  "data"          JSONB,
  CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MetricSnapshot_capturedAt_idx"
  ON "MetricSnapshot"("capturedAt");
