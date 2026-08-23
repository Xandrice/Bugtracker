-- Drop the in-dashboard Announcement table.
-- Discord is the source of truth for staff announcements.
--
-- Apply this outside the Vercel build (do not run as part of vercel-build / next build):
--   pnpm prisma migrate deploy
--   or pnpm prisma db push

DROP TABLE IF EXISTS "Announcement";
