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
- Keeping Prisma out of build avoids accidental table drops in shared/existing databases.

### 5) Cut over from Render

1. Deploy on Vercel.
2. Validate login + issue CRUD in production.
3. Point your custom domain to Vercel.
4. Disable/remove the Render service.
