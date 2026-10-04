-- Sprint 8 compatibility matcher.
--
-- AdopterQuiz holds an adopter's personality-quiz answers as JSON
-- ({ questionId: optionCode }), validated against config/matchQuiz.js, so the
-- questions can change without a migration.
--
-- AdopterMatch caches computed matches so page loads never call the AI. The
-- rows are disposable, so both foreign keys CASCADE: closing an adopter
-- account (DELETE /adopters/me) or deleting a pet clears its cached matches
-- instead of being blocked by them. aiScore is null for rule-only results.

-- CreateTable
CREATE TABLE "AdopterQuiz" (
    "adopterID" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdopterQuiz_pkey" PRIMARY KEY ("adopterID")
);

-- CreateTable
CREATE TABLE "AdopterMatch" (
    "adopterID" INTEGER NOT NULL,
    "petID" INTEGER NOT NULL,
    "ruleScore" INTEGER NOT NULL,
    "aiScore" INTEGER,
    "totalScore" INTEGER NOT NULL,
    "reason" VARCHAR(300),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdopterMatch_pkey" PRIMARY KEY ("adopterID","petID")
);

-- CreateIndex
CREATE INDEX "AdopterMatch_adopterID_totalScore_idx" ON "AdopterMatch"("adopterID", "totalScore");

-- AddForeignKey
ALTER TABLE "AdopterQuiz" ADD CONSTRAINT "AdopterQuiz_adopterID_fkey" FOREIGN KEY ("adopterID") REFERENCES "Adopter"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdopterMatch" ADD CONSTRAINT "AdopterMatch_adopterID_fkey" FOREIGN KEY ("adopterID") REFERENCES "Adopter"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdopterMatch" ADD CONSTRAINT "AdopterMatch_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE CASCADE ON UPDATE CASCADE;
