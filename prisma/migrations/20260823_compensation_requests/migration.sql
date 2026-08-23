-- Staff compensation / refund queue. Decision tracking only — no FiveM writes.
CREATE TABLE IF NOT EXISTS "CompensationRequest" (
  "id"               TEXT NOT NULL,
  "playerIdentifier" TEXT NOT NULL,
  "playerName"       TEXT,
  "discordId"        TEXT,
  "reason"           TEXT NOT NULL,
  "cashAmount"       DOUBLE PRECISION,
  "bankAmount"       DOUBLE PRECISION,
  "items"            JSONB,
  "evidence"         TEXT,
  "status"           TEXT NOT NULL DEFAULT 'OPEN',
  "requesterId"      TEXT NOT NULL,
  "assigneeId"       TEXT,
  "resolverId"       TEXT,
  "resolvedAt"       TIMESTAMP(3),
  "payerId"          TEXT,
  "paidAt"           TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompensationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompensationRequest_status_idx"
  ON "CompensationRequest"("status");

CREATE INDEX IF NOT EXISTS "CompensationRequest_playerIdentifier_idx"
  ON "CompensationRequest"("playerIdentifier");

CREATE INDEX IF NOT EXISTS "CompensationRequest_discordId_idx"
  ON "CompensationRequest"("discordId");

ALTER TABLE "CompensationRequest"
ADD CONSTRAINT "CompensationRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompensationRequest"
ADD CONSTRAINT "CompensationRequest_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompensationRequest"
ADD CONSTRAINT "CompensationRequest_resolverId_fkey"
  FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompensationRequest"
ADD CONSTRAINT "CompensationRequest_payerId_fkey"
  FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
