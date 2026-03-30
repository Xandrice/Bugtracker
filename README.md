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

`pnpm vercel-build` runs Prisma migrations before the Next build:

```json
"vercel-build": "prisma migrate deploy && next build"
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
- `DISCORD_BOT_TOKEN` (only if using Discord DM mention notifications)

### 4) Prisma migration notes

- If your current DB is SQLite and production is Postgres, export/import your data, then create/apply migrations against Postgres before cutover.
- On Vercel deploys, migrations are applied via `prisma migrate deploy`.

### 5) Cut over from Render

1. Deploy on Vercel.
2. Validate login + issue CRUD in production.
3. Point your custom domain to Vercel.
4. Disable/remove the Render service.
