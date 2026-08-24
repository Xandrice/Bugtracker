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

### VictoriaLogs notes

- Logs page endpoint: `/logs`
- Query backend: `POST /select/logsql/query`
- The page passes `AccountID` and `ProjectID` headers when configured.
- Access is controlled by `LOG_VIEW_ROLES`, so logs can be restricted to specific staff roles.

### 4) Prisma migration notes

- If your current DB is SQLite and production is Postgres, export/import your data, then apply schema to Postgres.
- Apply schema changes manually (outside the Vercel build) using either:
  - `pnpm prisma db push` (no migration history), or
  - `pnpm prisma migrate deploy` (after baseline/migrations are set up).
- Backlog ranking (`Issue.backlogRank`) ships as migration `20260823_issue_backlog_rank`. Apply it with `pnpm prisma migrate deploy`, or `pnpm prisma db push` if you are not using migration history. Do not run Prisma migrate as part of the Vercel build.
- Keeping Prisma out of build avoids accidental table drops in shared/existing databases.

### 5) Cut over from Render

1. Deploy on Vercel.
2. Validate login + issue CRUD in production.
3. Point your custom domain to Vercel.
4. Disable/remove the Render service.
