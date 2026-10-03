-- A vet deleting their own account (DELETE /vets/me) must not take the
-- pets' appointment history with them, and RESTRICT blocked the delete
-- outright for any vet with a past appointment. Make Appointment.vetID
-- nullable and SET NULL on delete — the same treatment HealthRecord.vetID
-- and VaccinationRecord.administeredBy already get. New appointments still
-- always name a vet (enforced by the API).

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_vetID_fkey";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "vetID" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vetID_fkey" FOREIGN KEY ("vetID") REFERENCES "Veterinarian"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
