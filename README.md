# FiveM Tracker

Bug and feature tracker for FiveM server development (Next.js + Prisma + Auth.js).

## Local development

1. Copy envs:
   - `cp .env.example .env.local` (or create `.env.local` manually on Windows)
2. Set `DATABASE_URL` in `.env.local` to your Postgres instance.
3. Install and run:

```bash
pnpm install
pnpm dev
```

### Optional: FiveM staff tools DB

`/staff-tools` can connect to your game database (MySQL) for player and vehicle management.
Set either:

- `FIVEM_DB_URL=mysql://user:pass@host:3306/database`

or split credentials:

- `FIVEM_DB_HOST`
- `FIVEM_DB_PORT` (default `3306`)
- `FIVEM_DB_USER`
- `FIVEM_DB_PASSWORD`
- `FIVEM_DB_NAME`

## Deploy to Vercel (migration from Render)

This app expects PostgreSQL for production on Vercel.

### 1) Move DB off Render

- Create a managed Postgres database (Neon, Supabase, or Vercel Postgres).
- Put its connection string in `DATABASE_URL`.

### 2) Configure Vercel project

- Import this GitHub repo into Vercel.
- Framework preset: Next.js.
- Build command:
  - `pnpm vercel-build`
- Install command:
  - `pnpm install`
- Output directory:
  - leave default (`.next`).

`pnpm vercel-build` runs the Next production build:

```json
"vercel-build": "next build"
```

### 3) Add Vercel environment variables

At minimum set:

- `DATABASE_URL` (managed Postgres connection string)
- `AUTH_SECRET` (random long secret)
- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `AUTH_TRUST_HOST=true`

Optional:

- `NEXTAUTH_URL` (not required on Vercel, but can be set to your production URL)
- `DISCORD_BOT_TOKEN` (required for DM mentions and posting tracker notices in Discord forum posts)
- `DISCORD_PUBLIC_KEY` (if receiving signed Discord interaction-style webhook requests)
- `DISCORD_WEBHOOK_SECRET` (shared-secret fallback for relayed bot gateway events)
- `VICTORIALOGS_URL` (required for in-panel logs viewer integration)
- `VICTORIALOGS_BEARER_TOKEN` (optional bearer auth for VictoriaLogs)
- `VICTORIALOGS_USERNAME` / `VICTORIALOGS_PASSWORD` (optional basic auth for VictoriaLogs)
- `VICTORIALOGS_ACCOUNT_ID` / `VICTORIALOGS_PROJECT_ID` (optional default tenant headers)
- `LOG_VIEW_ROLES` (comma-separated roles allowed to view `/logs`; default `Owner,Admin`)

### Discord forum sync notes

- Issue form now supports optional Discord channel/thread IDs.
- When an issue has linked Discord IDs, the bot posts an "added to developer tracker" message in the linked forum post/thread.
- Webhook endpoint: `/api/discord/webhooks`
- Supported inbound events: `MESSAGE_CREATE` and `THREAD_UPDATE`
- Inbound Discord comments become issue notes without requiring the Discord user to be a ProjectMember.
- If a linked thread is archived (`THREAD_UPDATE` with `archived=true`), the linked issue is auto-set to `DONE`.
- Sync is one-way for close state: resolving in the tracker does not archive/close Discord threads.

#### Public issue creation API

Discord bots can create issues programmatically via `POST /api/issues`.

**Auth:** Header `x-discord-webhook-secret` must match `DISCORD_WEBHOOK_SECRET`. Returns 401 if missing/wrong, 500 if env var unset.

**JSON body:**
- Required: `title` (string), `discordUserId` (Discord snowflake)
- Optional: `description`, `type` (BUG|FEATURE|TASK, default BUG), `priority` (LOW|MEDIUM|HIGH|URGENT, default MEDIUM), `severity` (MINOR|MAJOR|CRITICAL|BLOCKER, default MINOR), `status` (BACKLOG|OPEN|IN_PROGRESS|REVIEW|DONE, default OPEN), `discordThreadId` or `discordPostId` (string or discord.com URL), `resourceName`, `serverVersion`, `reproductionSteps`, `expectedBehavior`, `environment`, `tags`, `label`, `discordUserName`, `discordUserAvatar`

**Behavior:**
- Discord-first: the bot creates or already has a forum thread. This API does NOT create a Discord thread.
- If `discordThreadId` is already linked to an issue, returns 200 with existing issue (no duplicate).
- After creating a new issue with a linked thread, posts a tracker notice via Discord.

**Response:** 201 (new) or 200 (existing)
```json
{
  "id": "...",
  "publicKey": "...",
  "url": "https://tracker.example.com/issues/abc123",
  "title": "...",
  "existing": false
}
```

**Example:**
```bash
curl -X POST https://tracker.example.com/api/issues \
  -H "Content-Type: application/json" \
  -H "x-discord-webhook-secret: YOUR_SECRET" \
  -d '{
    "title": "Player spawn bug in new update",
    "discordUserId": "123456789012345678",
    "description": "Players spawn underground",
    "type": "BUG",
    "priority": "HIGH",
    "severity": "MAJOR",
    "discordThreadId": "987654321098765432"
  }'
```

#### Public player-report creation API

Discord bots can create mod-log / player reports via `POST /api/reports`. Created rows attach to the player 360 when `subjectDiscordId` matches the player's Discord snowflake.

**Auth:** Same as `POST /api/issues`. Header `x-discord-webhook-secret` must match `DISCORD_WEBHOOK_SECRET`. Returns 401 if missing/wrong, 500 if env var unset.

**JSON body:**
- Required: `title` (string), `discordUserId` (reporter Discord snowflake)
- Strongly wanted: `subjectDiscordId` (accused player's Discord snowflake — this is what the player 360 uses)
- Optional: `subjectName`, `accusedPlayer`, `description`, `category` (CONDUCT|WARNING|TOXICITY|HARASSMENT|CHEATING|OTHER, default OTHER), `evidenceLinks`, `discordThreadId` or `discordPostId` (string or discord.com URL), `discordUserName`, `discordUserAvatar`, `reporterName`

**Behavior:**
- Discord-first: the bot already has the ticket/thread. This API does NOT create a Discord thread or post back into Discord.
- Resolves or creates the reporter `User` the same way as `POST /api/issues`.
- If `discordThreadId` is already linked to a report, returns 200 with the existing report (no duplicate).
- Thread id is stored on `PlayerReport.discordThreadId` (unique). Apply that column outside the Vercel build (`pnpm prisma migrate deploy` or `pnpm prisma db push`). A Discord thread link is also footnoted on `evidenceLinks` so it shows on `/reports/...`.

**Response:** 201 (new) or 200 (existing)
```json
{
  "id": "...",
  "url": "https://tracker.example.com/reports/...",
  "title": "...",
  "existing": false
}
```

**Example:**
```bash
curl -X POST https://tracker.example.com/api/reports \
  -H "Content-Type: application/json" \
  -H "x-discord-webhook-secret: YOUR_SECRET" \
  -d '{
    "title": "RDM at Legion",
    "discordUserId": "111111111111111111",
    "subjectDiscordId": "222222222222222222",
    "subjectName": "Accused Player",
    "description": "Random deathmatch after a traffic stop",
    "category": "CONDUCT",
    "evidenceLinks": "https://example.com/clip",
    "discordThreadId": "987654321098765432"
  }'
```

### VictoriaLogs notes

- Logs page endpoint: `/logs`
- Query backend: `POST /select/logsql/query`
- The page passes `AccountID` and `ProjectID` headers when configured.
- Access is controlled by `LOG_VIEW_ROLES`, so logs can be restricted to specific staff roles.

### Staff live player map

`/staff-tools/map` is a staff-only San Andreas map shell. It is gated with the same `canViewStaffPlayers` permission as `/staff-tools/players`.

This repo and the FiveM MySQL helpers do **not** contain live player XYZ. Presence today is playtime / first-last seen. The map therefore ships empty until a FiveM server or Renny publisher posts positions. The UI never invents markers.

No Prisma model is added. Ingest is held in process memory and goes stale after 90 seconds. That store is instance-local on Vercel — do not treat it as a durable live feed. If a later durable store is needed, apply any migrate **outside** `vercel-build` / `next build` (Xandrice-only).

#### Ingest: `POST /api/staff-tools/live-map`

**Auth:** Same as `POST /api/issues`. Header `x-discord-webhook-secret` must match `DISCORD_WEBHOOK_SECRET`. Returns 401 if missing/wrong, 500 if env var unset.

Each POST **replaces** the current online set. Send the full currently-online list on every tick (every 5–15s). An empty `players` array means “publisher is up, nobody online.”

**JSON body:**
- Required: `players` (array)
- Optional: `source` (`fivem` | `renny`, default `fivem`), `serverId` (string)
- Each player: required `identifier` (string), `x` (number), `y` (number); optional `name`, `z`, `heading`

```json
{
  "source": "fivem",
  "serverId": "renegade-1",
  "players": [
    {
      "identifier": "ABC12345",
      "name": "Alex",
      "x": 215.5,
      "y": -890.25,
      "z": 30.1,
      "heading": 91
    }
  ]
}
```

**Response:** `200`
```json
{ "ok": true, "accepted": 1, "rejected": 0, "staleAfterMs": 90000 }
```

#### Staff read: `GET /api/staff-tools/live-map`

**Auth:** Signed-in session with `canViewStaffPlayers`. Returns 401 if unsigned, 403 if the role cannot view staff players.

**Response:**
```json
{
  "available": false,
  "source": null,
  "serverId": null,
  "publisherRequired": true,
  "note": "Live positions require a FiveM server or Renny publisher posting to POST /api/staff-tools/live-map. This repo does not read player XYZ from MySQL and does not invent coordinates.",
  "players": [],
  "receivedAt": null,
  "staleAfterMs": 90000
}
```

When a fresh ingest exists, `available` is `true`, `publisherRequired` is `false`, `note` is `null`, and `players` is only the last published set.

### Staff compensation queue

`/staff-tools/compensation` is a refund decision queue (lost items, wipe, bug loss). Staff file a request against a citizenid/identifier; a senior approves or denies; someone marks it paid after paying out in-game or via txAdmin.

This does **not** write cash, bank, or items to the live FiveM MySQL. There is no give-item or set-money action.

View access follows existing staff-tools player or economy view. Filing, assignment, approve/deny, and mark-paid require manage-player permission or an Admin / Moderator (or Owner) role.

### Issue watchers

Signed-in users can Watch / Unwatch an issue from the issue detail sidebar (People). Watchers share the existing `notifyUser` / Discord DM path:

- **STATUS_CHANGE:** reporter and assignee are *implicit* watchers (notified without a row, same as today). Explicit `IssueWatcher` rows are added to that recipient set.
- **COMMENT:** assignee is still notified; explicit watchers are added. Reporter is not auto-notified for comments unless they Watch.
- Unwatch removes only the explicit row; it does not stop reporter/assignee status notifications while those roles apply.

`/issues/me` has an Assigned / Watching filter for explicit subscriptions.

### 4) Prisma migration notes

- If your current DB is SQLite and production is Postgres, export/import your data, then apply schema to Postgres.
- Apply schema changes manually (outside the Vercel build) using either:
  - `pnpm prisma db push` (no migration history), or
  - `pnpm prisma migrate deploy` (after baseline/migrations are set up).
- Backlog ranking (`Issue.backlogRank`) ships as migration `20260823_issue_backlog_rank`. Apply it with `pnpm prisma migrate deploy`, or `pnpm prisma db push` if you are not using migration history. Do not run Prisma migrate as part of the Vercel build.
- Keeping Prisma out of build avoids accidental table drops in shared/existing databases.
- Staff tools write audit (`StaffAuditEvent` — ban, whitelist, garage/storage toggles) is a Prisma table. Apply `prisma/migrations/20260823_staff_audit_events` with `pnpm prisma migrate deploy` or `pnpm prisma db push` **outside** `vercel-build` / `next build`. Do not add migrate to the Vercel build command.
- Compensation queue (`CompensationRequest`) ships as `prisma/migrations/20260823_compensation_requests`. Apply it with `pnpm prisma migrate deploy` or `pnpm prisma db push` against your Postgres instance — do not run migrate as part of `vercel-build` / `next build`.
- Issue templates (`IssueTemplate`) ship as `prisma/migrations/20260824_issue_templates`, including four seed templates (bug report, script crash, feature request, player-facing task). The INSERT is one-shot (`ON CONFLICT DO NOTHING`) so later staff edits are kept. A matching upsert also runs on `/issues/new` and `/issues/templates` for databases that used `db push` without the SQL seed. Apply the migration with `pnpm prisma migrate deploy` or `pnpm prisma db push` **outside** `vercel-build` / `next build`. Owner/Admin staff manage templates at `/issues/templates`; everyone else can optionally pick one on `/issues/new`.
- Issue watchers (`IssueWatcher`) ships as `prisma/migrations/20260824_issue_watchers`. Apply it with `pnpm prisma migrate deploy` or `pnpm prisma db push` **outside** `vercel-build` / `next build`. Reporter and assignee are implicit watchers for status changes (notified without a row). Watch / Unwatch on the issue page manages explicit subscribers, who also get comment notifications alongside the assignee.

### 5) Cut over from Render

1. Deploy on Vercel.
2. Validate login + issue CRUD in production.
3. Point your custom domain to Vercel.
4. Disable/remove the Render service.
