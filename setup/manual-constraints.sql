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

ALTER TABLE "Volunteer" ADD COLUMN IF NOT EXISTS "volunteerCode" TEXT
  GENERATED ALWAYS AS ('VOL-' || lpad("userID"::text, 5, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS "Volunteer_volunteerCode_key" ON "Volunteer" ("volunteerCode");

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

-- ── Admin / Veterinarian self-registration approval gate ────────
-- StaffAccountStatus already had Pending (self-registered staff await admin
-- approval). Admin and Veterinarian now follow the same shape — both
-- schema.prisma default to @default(Pending) — but since this project treats
-- every schema change as hand-applied SQL rather than a new Prisma migration
-- (see CLAUDE.md's Permanent Known Issues), the enum value and column
-- default themselves only exist here.
--
-- IMPORTANT: run the two ALTER TYPE statements below FIRST, on their own —
-- click Run, wait for it to finish — THEN run the two ALTER TABLE statements
-- as a separate paste/Run. Postgres refuses to use a brand-new enum value in
-- the same transaction that added it, and Supabase's SQL Editor sends a
-- multi-statement paste as one implicit transaction.
ALTER TYPE "AdminAccountStatus" ADD VALUE IF NOT EXISTS 'Pending';
ALTER TYPE "VetAccountStatus" ADD VALUE IF NOT EXISTS 'Pending';

-- ── Run only after the ALTER TYPE statements above have committed ──
ALTER TABLE "Admin" ALTER COLUMN "accountStatus" SET DEFAULT 'Pending';
ALTER TABLE "Veterinarian" ALTER COLUMN "accountStatus" SET DEFAULT 'Pending';

-- ── Admin profile fields + status-change audit trail ────────────
-- adminPhone/lastLoginAt are plain nullable columns. statusChangedByID is a
-- self-referencing FK (which Admin last approved/declined/activated/
-- deactivated this one) — SET NULL on delete so removing an admin who
-- previously acted on others doesn't block or cascade-delete anything.
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "adminPhone" VARCHAR(20);
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "statusChangedByID" INTEGER;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "Admin" DROP CONSTRAINT IF EXISTS "Admin_statusChangedByID_fkey";
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_statusChangedByID_fkey"
  FOREIGN KEY ("statusChangedByID") REFERENCES "Admin"("userID")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Admin demographic fields (parity with Staff/Veterinarian) ───
-- Plain nullable columns, safe as a single paste. GovernmentID needs no
-- schema change at all — it's already role-agnostic via userType, and
-- 'Admin' is already a UserType enum value.
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "adminAddress" VARCHAR(45);
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "adminDOB" DATE;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "adminSex" CHAR(1);

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
