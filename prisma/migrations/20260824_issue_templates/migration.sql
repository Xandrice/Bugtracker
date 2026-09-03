-- Named, reusable issue templates for /issues/new. Seeds are one-shot
-- (ON CONFLICT DO NOTHING) so staff edits are not overwritten on migrate.
CREATE TABLE IF NOT EXISTS "IssueTemplate" (
  "id"                TEXT NOT NULL,
  "slug"              TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "type"              TEXT NOT NULL DEFAULT 'BUG',
  "priority"          TEXT NOT NULL DEFAULT 'MEDIUM',
  "severity"          TEXT NOT NULL DEFAULT 'MINOR',
  "titleHint"         TEXT,
  "title"             TEXT,
  "body"              TEXT,
  "reproductionSteps" TEXT,
  "expectedBehavior"  TEXT,
  "resourceName"      TEXT,
  "sortOrder"         INTEGER NOT NULL DEFAULT 0,
  "archivedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssueTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IssueTemplate_slug_key" ON "IssueTemplate"("slug");

CREATE INDEX IF NOT EXISTS "IssueTemplate_archivedAt_sortOrder_idx"
  ON "IssueTemplate"("archivedAt", "sortOrder");

INSERT INTO "IssueTemplate" (
  "id",
  "slug",
  "name",
  "description",
  "type",
  "priority",
  "severity",
  "titleHint",
  "title",
  "body",
  "reproductionSteps",
  "expectedBehavior",
  "resourceName",
  "sortOrder"
)
VALUES
(
  'issue-template-bug-report',
  'bug-report',
  'Bug report',
  'Repro steps, expected behavior, and who is affected.',
  'BUG',
  'MEDIUM',
  'MINOR',
  'E.g. Police MDT fails to load when off duty',
  NULL,
  $bug_body$What happened?

Who was affected (how many players, which jobs or areas)?

Client or server errors (F8, txAdmin, or server console):$bug_body$,
  $bug_repro$1.
2.
3.$bug_repro$,
  'What should have happened instead?',
  NULL,
  10
),
(
  'issue-template-script-crash',
  'script-crash',
  'Script crash',
  'Resource exception or crash that takes a script down.',
  'BUG',
  'HIGH',
  'CRITICAL',
  'E.g. ox_inventory crashes when using an item',
  NULL,
  $crash_body$Which resource crashed (fxmanifest / resource folder name)?

Client, server, or both?

Error or stack trace from F8 or the server console:

Did the resource restart, or did it stay dead?$crash_body$,
  $crash_repro$1. Start or join the server
2.
3. Crash or exception occurs$crash_repro$,
  'The resource should stay running and handle the failure without taking the script down.',
  NULL,
  20
),
(
  'issue-template-feature-request',
  'feature-request',
  'Feature request',
  'New player or staff capability, with problem and proposed change.',
  'FEATURE',
  'MEDIUM',
  'MINOR',
  'E.g. Add inventory weight indicator',
  NULL,
  $feature_body$Problem — what is awkward or missing for staff or players?

Proposed change:

Who does this help (players, a job, staff)?

Anything this should not change?$feature_body$,
  NULL,
  NULL,
  NULL,
  30
),
(
  'issue-template-player-facing-task',
  'player-facing-task',
  'Player-facing task',
  'World, prop, or job work players will notice in-game.',
  'TASK',
  'MEDIUM',
  'MINOR',
  'E.g. Restock hospital pharmacy props after the interior update',
  NULL,
  $task_body$What should players see or be able to do when this is done?

Location / job / area:

Acceptance:
-$task_body$,
  NULL,
  NULL,
  NULL,
  40
)
ON CONFLICT ("slug") DO NOTHING;
