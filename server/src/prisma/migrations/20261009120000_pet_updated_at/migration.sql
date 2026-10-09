-- Sprint 8 compatibility matcher: Pet.updatedAt lets the AdopterMatch cache
-- tell when a pet changed after its matches were computed. Prisma bumps it on
-- every write (@updatedAt); existing rows start at the migration time, which
-- only makes caches computed before it look stale once.

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
