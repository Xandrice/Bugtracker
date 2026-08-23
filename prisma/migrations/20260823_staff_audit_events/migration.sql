-- Attributed audit of staff dashboard writes that change the live FiveM DB
-- (ban, whitelist, garage/storage). Apply outside the Vercel build
-- (`pnpm prisma migrate deploy` or `pnpm prisma db push`).
CREATE TABLE IF NOT EXISTS "StaffAuditEvent" (
  "id"          TEXT NOT NULL,
  "actorId"     TEXT,
  "actorName"   TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "targetType"  TEXT NOT NULL,
  "targetKey"   TEXT NOT NULL,
  "targetLabel" TEXT,
  "playerKey"   TEXT,
  "field"       TEXT NOT NULL,
  "oldValue"    TEXT,
  "newValue"    TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffAuditEvent_createdAt_idx"
  ON "StaffAuditEvent"("createdAt");

CREATE INDEX IF NOT EXISTS "StaffAuditEvent_targetType_targetKey_createdAt_idx"
  ON "StaffAuditEvent"("targetType", "targetKey", "createdAt");

CREATE INDEX IF NOT EXISTS "StaffAuditEvent_playerKey_createdAt_idx"
  ON "StaffAuditEvent"("playerKey", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StaffAuditEvent_actorId_fkey'
  ) THEN
    ALTER TABLE "StaffAuditEvent"
      ADD CONSTRAINT "StaffAuditEvent_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
