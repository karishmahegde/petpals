-- PetPals — the one piece of setup that isn't a Prisma migration
--
-- Everything in the database schema — including what schema.prisma can't
-- express (PostGIS, the generated reference codes, the partial unique
-- indexes) — is built by `npx prisma migrate deploy` from
-- server/src/prisma/migrations/. See the baseline migration's header.
--
-- What's left are the Supabase Storage buckets. They're rows in Supabase's
-- own `storage` schema, which only exists on Supabase, so they don't belong
-- in a Prisma migration.
--
-- Run once per Supabase project, in the SQL Editor (Project → SQL Editor →
-- New query → paste → Run). Safe to re-run.

-- pet-images is public (photo URLs are served directly). government-ids must
-- stay private — only the server's service-role key can read or write it.
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-images', 'pet-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('government-ids', 'government-ids', false)
ON CONFLICT (id) DO NOTHING;
