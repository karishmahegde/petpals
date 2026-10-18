-- Sprint 8 health-passport summary.
--
-- PetHealthSummary caches one AI summary per pet, keyed by inputHash (SHA-256
-- hex of the prompt + the pet's records, doses and transfers), so the AI is
-- only called again once the passport changes. Disposable, so the foreign key
-- CASCADEs: deleting a pet clears its cached summary.

-- CreateTable
CREATE TABLE "PetHealthSummary" (
    "petID" INTEGER NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "summary" VARCHAR(1500) NOT NULL,
    "pointsToReview" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetHealthSummary_pkey" PRIMARY KEY ("petID")
);

-- AddForeignKey
ALTER TABLE "PetHealthSummary" ADD CONSTRAINT "PetHealthSummary_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE CASCADE ON UPDATE CASCADE;
