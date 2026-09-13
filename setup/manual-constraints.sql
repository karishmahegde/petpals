-- PetPals — hand-applied database pieces
--
-- Prisma's migration files (server/src/prisma/migrations/) cover everything
-- Prisma can express. These few pieces it can't (PostGIS types, generated
-- columns, and a partial unique index), so per CLAUDE.md they're applied by
-- hand instead of via `prisma migrate dev` — see the "Permanent Known Issues"
-- section there for why `migrate dev` must never be run against this schema.
--
-- Run this ONCE, after `npx prisma migrate deploy` and before `npx prisma db
-- seed`, in the Supabase SQL Editor (Project → SQL Editor → New query → paste
-- this whole file → Run). It's written to be safe to re-run.

-- ── PostGIS ──────────────────────────────────────────────────────
-- Supabase ships the extension but each project must enable it once.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Shelter.shelterLocation — geography point used by /shelters/nearby
-- (ST_MakePoint/SetSRID/Distance/DWithin). Modeled in schema.prisma as
-- `Unsupported("geography")?` since Prisma has no native PostGIS type.
ALTER TABLE "Shelter" ADD COLUMN IF NOT EXISTS "shelterLocation" geography(Point, 4326);

-- ── Human-facing reference codes ────────────────────────────────
-- Postgres GENERATED ALWAYS STORED columns computed from each row's PK.
-- Prisma has no first-class support for generated columns, so these are
-- typed `String? @unique` in schema.prisma and populated by Postgres itself
-- on insert — never set them from application code.
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "petCode" TEXT
  GENERATED ALWAYS AS ('PE' || lpad("petID"::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS "Pet_petCode_key" ON "Pet" ("petCode");

ALTER TABLE "AdoptionApplication" ADD COLUMN IF NOT EXISTS "applicationCode" TEXT
  GENERATED ALWAYS AS ('APP-' || lpad("applicationID"::text, 5, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS "AdoptionApplication_applicationCode_key" ON "AdoptionApplication" ("applicationCode");

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "appointmentCode" TEXT
  GENERATED ALWAYS AS ('APT-' || lpad("appointmentID"::text, 5, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_appointmentCode_key" ON "Appointment" ("appointmentCode");

-- ── Staff closing note on an application ────────────────────────
-- Plain nullable column — not generated, just added by hand alongside the
-- codes above.
ALTER TABLE "AdoptionApplication" ADD COLUMN IF NOT EXISTS "staffRemark" VARCHAR(300);

-- ── One active application per adopter+pet ──────────────────────
-- Partial unique index — not expressible as a Prisma @@unique. Blocks a
-- second Pending/Accepted application for the same adopter+pet while still
-- allowing resubmission after a Rejected/Withdrawn one.
CREATE UNIQUE INDEX IF NOT EXISTS "AdoptionApplication_active_adopter_pet_key"
  ON "AdoptionApplication" ("adopterID", "petID")
  WHERE "applicationStatus" IN ('Pending', 'Accepted');

-- ── Storage buckets ──────────────────────────────────────────────
-- Supabase Storage buckets are just rows in storage.buckets, so they can be
-- created here instead of by hand in the dashboard. pet-images is public
-- (photo URLs are served directly); government-ids must stay private — only
-- the service-role key (server-side) can read/write it.
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-images', 'pet-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('government-ids', 'government-ids', false)
ON CONFLICT (id) DO NOTHING;
