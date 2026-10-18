-- Splits "Deactivated" three ways: Closed (the owner closed it — the only state
-- they can reactivate themselves), Declined (turned down at approval) and
-- Deactivated (done by an admin/staff member). Its own migration: Postgres
-- can't use a new enum value in the transaction that adds it, and the
-- backfill that relabels rows comes in the next migration.
ALTER TYPE "AdopterAccountStatus" ADD VALUE 'Closed';
ALTER TYPE "DonorAccountStatus" ADD VALUE 'Closed';

ALTER TYPE "StaffAccountStatus" ADD VALUE 'Closed';
ALTER TYPE "StaffAccountStatus" ADD VALUE 'Declined';

ALTER TYPE "VetAccountStatus" ADD VALUE 'Closed';
ALTER TYPE "VetAccountStatus" ADD VALUE 'Declined';

ALTER TYPE "AdminAccountStatus" ADD VALUE 'Closed';
ALTER TYPE "AdminAccountStatus" ADD VALUE 'Declined';

ALTER TYPE "VolunteerAccountStatus" ADD VALUE 'Closed';
ALTER TYPE "VolunteerAccountStatus" ADD VALUE 'Declined';
