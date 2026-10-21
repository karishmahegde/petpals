-- Sprint 10 in-app notifications (the dashboard bell).
--
-- Replaces the original design's Notification table — scheduled outbound
-- reminders (recipientID + recipientType with no foreign key, sendTime,
-- Pending/Sent/Failed) that nothing in the app ever read or wrote; only seed
-- rows existed. Dropped with its three enums rather than altered, since no
-- column carries over. The new table is one row per recipient, keyed to Users
-- (CASCADE), with read state on the row.

-- DropTable
DROP TABLE "Notification";

-- DropEnum
DROP TYPE "NotificationType";
DROP TYPE "NotificationStatus";
DROP TYPE "RecipientType";

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ApplicationSubmitted', 'ApplicationApproved', 'ApplicationDeclined', 'VisitConfirmed', 'VisitCancelled', 'AppointmentScheduled', 'AppointmentChanged', 'AppointmentCancelled', 'GovernmentIdVerified', 'GovernmentIdRejected', 'NewApplication', 'NewVisitRequest', 'ApplicationWithdrawn', 'VisitCancelledByAdopter', 'SignupReadyForApproval', 'TransferIncoming', 'TransferCompleted', 'TransferRejected', 'TransferCancelled', 'CapacityAlert', 'AppointmentAssigned', 'TaskAssigned', 'EventAssigned', 'EventCancelled', 'AppointmentAssistAssigned', 'AppointmentAssistCancelled', 'DonationReceived', 'AdminSignupPending');

-- CreateTable
CREATE TABLE "Notification" (
    "notificationID" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "link" VARCHAR(200),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("notificationID")
);

-- CreateIndex
CREATE INDEX "Notification_userID_createdAt_idx" ON "Notification"("userID", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userID_readAt_idx" ON "Notification"("userID", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE CASCADE ON UPDATE CASCADE;
