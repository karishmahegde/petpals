-- Donations go through Stripe Checkout (POST /donations/checkout), the same
-- flow as the adoption application fee: the Donation row is created by the
-- checkout.session.completed webhook after payment. stripeCheckoutSessionID
-- is unique so a replayed webhook can't record a donation twice; both
-- columns are nullable because donations recorded before this release have
-- no Stripe session.
--
-- A donor deleting their own account (DELETE /donors/me) must not take the
-- shelter's donation history with them, and RESTRICT would block the delete
-- outright for any donor who has ever given. Make Donation.donorID nullable
-- and SET NULL on delete — the same treatment as Appointment.vetID.

-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_donorID_fkey";

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "stripeCheckoutSessionID" VARCHAR(255),
ADD COLUMN     "stripePaymentIntentID" VARCHAR(255),
ALTER COLUMN "donorID" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripeCheckoutSessionID_key" ON "Donation"("stripeCheckoutSessionID");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorID_fkey" FOREIGN KEY ("donorID") REFERENCES "Donor"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
