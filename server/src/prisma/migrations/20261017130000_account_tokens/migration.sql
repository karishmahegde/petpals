-- Sprint 9 email + account security.
--
-- AccountToken holds the single-use emailed links (verify email, reset
-- password, reactivate a Closed account, confirm an email change). Only the
-- SHA-256 hex of each random token is stored. CASCADEs from Users, so deleting
-- an account clears its tokens.

-- CreateEnum
CREATE TYPE "AccountTokenPurpose" AS ENUM ('EmailVerification', 'PasswordReset', 'Reactivation', 'EmailChange');

-- CreateTable
CREATE TABLE "AccountToken" (
    "tokenID" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "purpose" "AccountTokenPurpose" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "newEmail" VARCHAR(45),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("tokenID")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountToken_userID_purpose_idx" ON "AccountToken"("userID", "purpose");

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: accounts that existed before verification emails count as
-- verified, so the soft gate (applying to adopt, donating) doesn't suddenly
-- block them.
UPDATE "Users" SET "emailVerified" = true;

-- Backfill: an admin who closed their own account is the only Deactivated row
-- whose origin is recorded (statusChangedByID = self) — relabel it Closed so
-- it can be reactivated. Every other Deactivated row stays Deactivated, since
-- self-close and admin/staff deactivation can't be told apart.
UPDATE "Admin" SET "accountStatus" = 'Closed'
WHERE "accountStatus" = 'Deactivated' AND "statusChangedByID" = "userID";
