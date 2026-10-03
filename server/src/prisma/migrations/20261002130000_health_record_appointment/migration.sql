-- Links a HealthRecord to the appointment it was written at (a vet's notes
-- when completing it — PATCH /appointments/:id/status), mirroring
-- VaccinationRecord.appointmentID. Nullable: records made outside any
-- appointment have none, and deleting an appointment keeps its notes.

-- AlterTable
ALTER TABLE "HealthRecord" ADD COLUMN "appointmentID" INTEGER;

-- CreateIndex
CREATE INDEX "HealthRecord_appointmentID_idx" ON "HealthRecord"("appointmentID");

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_appointmentID_fkey" FOREIGN KEY ("appointmentID") REFERENCES "Appointment"("appointmentID") ON DELETE SET NULL ON UPDATE CASCADE;
