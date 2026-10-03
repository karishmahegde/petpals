-- A dose's next-due date becomes optional: null means the vet planned no
-- further dose (senior or immunocompromised pet, titer shows immunity, a
-- non-core vaccine discontinued, history carried in at intake). Such a dose
-- is never overdue. Existing rows keep their dates.

-- AlterTable
ALTER TABLE "VaccinationRecord" ALTER COLUMN "dueDate" DROP NOT NULL;
