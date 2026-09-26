-- PetPals baseline — the complete schema as of 2026-09-26.
--
-- Generated with `prisma migrate diff --from-empty --to-schema` and then
-- hand-edited to add what Prisma can't express, so that `prisma migrate
-- deploy` alone builds a database the app can run on:
--   * PostGIS (extension + Shelter.shelterLocation as a real geography point,
--     plus its GiST index)
--   * the human-facing reference codes (petCode, applicationCode, …) as
--     Postgres GENERATED ALWAYS STORED columns — Prisma only sees them as
--     plain nullable text, so never write them from application code
--   * the two partial unique indexes
-- Replaces the old 20260625234222_init migration plus the upgrade steps that
-- used to live in setup/manual-constraints.sql.

-- ── PostGIS ─────────────────────────────────────────────────────
-- Supabase keeps extensions in their own schema (on the default search_path).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "role" AS ENUM ('Adopter', 'Volunteer', 'Donor', 'Admin', 'Staff', 'Veterinarian');

-- CreateEnum
CREATE TYPE "ShelterStatus" AS ENUM ('Open', 'Full', 'Closed');

-- CreateEnum
CREATE TYPE "StaffDesignation" AS ENUM ('Manager', 'Senior', 'Associate');

-- CreateEnum
CREATE TYPE "PetSize" AS ENUM ('Small', 'Medium', 'Large');

-- CreateEnum
CREATE TYPE "IntakeType" AS ENUM ('stray', 'surrendered', 'transferred');

-- CreateEnum
CREATE TYPE "AdoptionStatus" AS ENUM ('incoming', 'available', 'adopted', 'fostered', 'transferred', 'deceased');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('Apartment', 'House', 'Other');

-- CreateEnum
CREATE TYPE "OwnsOrRents" AS ENUM ('Owns', 'Rents');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('Unemployed', 'Student', 'Self_employed', 'Employed');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('Sedentary', 'Medium', 'Active');

-- CreateEnum
CREATE TYPE "PetExperience" AS ENUM ('No', 'Little', 'Some', 'Very');

-- CreateEnum
CREATE TYPE "PreferredAgeRange" AS ENUM ('Young', 'Adult', 'Old');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('Adopt', 'Foster');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Paid');

-- CreateEnum
CREATE TYPE "AdopterAccountStatus" AS ENUM ('Active', 'Banned', 'Deactivated');

-- CreateEnum
CREATE TYPE "DonorAccountStatus" AS ENUM ('Active', 'Banned', 'Deactivated');

-- CreateEnum
CREATE TYPE "StaffAccountStatus" AS ENUM ('Pending', 'Active', 'Deactivated');

-- CreateEnum
CREATE TYPE "VetAccountStatus" AS ENUM ('Pending', 'Active', 'Deactivated');

-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('Pending', 'Active', 'Deactivated');

-- CreateEnum
CREATE TYPE "VolunteerAccountStatus" AS ENUM ('Pending', 'Active', 'Banned', 'Deactivated');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('Confirmed', 'Cancelled', 'Completed');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('In_Progress', 'Completed', 'Rejected', 'Cancelled');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('Scheduled', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Withdrawn');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('vaccination', 'appointment', 'task');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('Pending', 'Sent', 'Failed');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('adopter', 'staff', 'volunteer', 'veterinarian');

-- CreateEnum
CREATE TYPE "VolunteerAppStatus" AS ENUM ('Created', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('Adopter', 'Staff', 'Volunteer', 'Veterinarian', 'Admin');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('Pending', 'Verified', 'Rejected');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('Adoption_Event', 'Fundraiser', 'Volunteer_Orientation', 'Vaccination_Clinic', 'Community_Outreach', 'Workshop', 'Donation_Drive', 'Other');

-- CreateEnum
CREATE TYPE "TaskName" AS ENUM ('Animal_Care', 'Vet_Assistance', 'Cleaning', 'Feeding', 'Events', 'Admin', 'Other');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('In_progress', 'Completed', 'Cancelled');

-- CreateTable
CREATE TABLE "Users" (
    "userID" SERIAL NOT NULL,
    "userEmail" VARCHAR(45) NOT NULL,
    "userPassword" VARCHAR(255) NOT NULL,
    "refreshToken" TEXT,
    "role" "role" NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Admin" (
    "userID" INTEGER NOT NULL,
    "avatarSeed" VARCHAR(64) NOT NULL,
    "adminName" VARCHAR(45) NOT NULL,
    "adminPhone" VARCHAR(20),
    "adminDOB" DATE,
    "adminSex" CHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addressLine1" VARCHAR(100) NOT NULL DEFAULT '',
    "addressLine2" VARCHAR(100),
    "city" VARCHAR(45) NOT NULL DEFAULT '',
    "state" VARCHAR(45) NOT NULL DEFAULT '',
    "zip" VARCHAR(10) NOT NULL DEFAULT '',
    "country" VARCHAR(45) NOT NULL DEFAULT '',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 2,
    "accountStatus" "AdminAccountStatus" DEFAULT 'Pending',
    "statusChangedByID" INTEGER,
    "statusChangedAt" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Shelter" (
    "shelterID" SERIAL NOT NULL,
    "shelterName" VARCHAR(45) NOT NULL,
    "shelterAddress" VARCHAR(45) NOT NULL,
    "shelterPhone" VARCHAR(20) NOT NULL,
    "shelterEmail" VARCHAR(45) NOT NULL,
    "shelterZIP" INTEGER NOT NULL,
    "shelterSize" INTEGER NOT NULL,
    "shelterStatus" "ShelterStatus" NOT NULL DEFAULT 'Open',
    "managerStaffID" INTEGER,
    "shelterLocation" extensions.geography(Point, 4326),

    CONSTRAINT "Shelter_pkey" PRIMARY KEY ("shelterID")
);

-- CreateTable
CREATE TABLE "Staff" (
    "userID" INTEGER NOT NULL,
    "avatarSeed" VARCHAR(64) NOT NULL,
    "staffName" VARCHAR(45) NOT NULL,
    "staffPhone" VARCHAR(20),
    "shelterID" INTEGER,
    "staffDOB" DATE,
    "staffSex" CHAR(1),
    "staffDOJ" TIMESTAMP(3),
    "staffDOS" TIMESTAMP(3),
    "staffDesignation" "StaffDesignation",
    "accountStatus" "StaffAccountStatus" DEFAULT 'Pending',
    "addressLine1" VARCHAR(100) NOT NULL DEFAULT '',
    "addressLine2" VARCHAR(100),
    "city" VARCHAR(45) NOT NULL DEFAULT '',
    "state" VARCHAR(45) NOT NULL DEFAULT '',
    "zip" VARCHAR(10) NOT NULL DEFAULT '',
    "country" VARCHAR(45) NOT NULL DEFAULT '',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Veterinarian" (
    "userID" INTEGER NOT NULL,
    "avatarSeed" VARCHAR(64) NOT NULL,
    "vetName" VARCHAR(45) NOT NULL,
    "vetPhone" VARCHAR(20),
    "vetDOB" DATE,
    "vetSex" CHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shelterID" INTEGER,
    "accountStatus" "VetAccountStatus" DEFAULT 'Pending',
    "addressLine1" VARCHAR(100) NOT NULL DEFAULT '',
    "addressLine2" VARCHAR(100),
    "city" VARCHAR(45) NOT NULL DEFAULT '',
    "state" VARCHAR(45) NOT NULL DEFAULT '',
    "zip" VARCHAR(10) NOT NULL DEFAULT '',
    "country" VARCHAR(45) NOT NULL DEFAULT '',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Veterinarian_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Species" (
    "speciesID" SERIAL NOT NULL,
    "speciesName" VARCHAR(45) NOT NULL,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("speciesID")
);

-- CreateTable
CREATE TABLE "Breed" (
    "breedID" SERIAL NOT NULL,
    "speciesID" INTEGER NOT NULL,
    "breedName" VARCHAR(45) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("breedID")
);

-- CreateTable
CREATE TABLE "Pet" (
    "petID" SERIAL NOT NULL,
    "petCode" TEXT GENERATED ALWAYS AS ('PE' || lpad("petID"::text, 6, '0')) STORED,
    "petName" VARCHAR(45) NOT NULL,
    "breedID" INTEGER NOT NULL,
    "petDOB" DATE NOT NULL,
    "petWeight" DOUBLE PRECISION NOT NULL,
    "petHeight" DOUBLE PRECISION NOT NULL,
    "petBGroup" VARCHAR(5) NOT NULL,
    "petColor" VARCHAR(45) NOT NULL,
    "petSize" "PetSize",
    "petPhoto" VARCHAR(300) NOT NULL,
    "petSex" CHAR(1) NOT NULL,
    "petDesc" VARCHAR(500),
    "microchipID" VARCHAR(45),
    "intakeDate" TIMESTAMP(3) NOT NULL,
    "intakeType" "IntakeType",
    "adoptionStatus" "AdoptionStatus",
    "shelterID" INTEGER NOT NULL,
    "staffID" INTEGER,
    "compatibleWithChildren" BOOLEAN NOT NULL DEFAULT false,
    "compatibleWithPets" BOOLEAN NOT NULL DEFAULT false,
    "specialNeeds" BOOLEAN NOT NULL DEFAULT false,
    "featuredFlag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("petID")
);

-- CreateTable
CREATE TABLE "PetPhoto" (
    "photoID" SERIAL NOT NULL,
    "petID" INTEGER NOT NULL,
    "photoURL" VARCHAR(300) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetPhoto_pkey" PRIMARY KEY ("photoID")
);

-- CreateTable
CREATE TABLE "Adopter" (
    "userID" INTEGER NOT NULL,
    "avatarSeed" VARCHAR(64) NOT NULL,
    "adopterName" VARCHAR(45) NOT NULL,
    "adopterDOB" DATE,
    "adopterSex" CHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adopterRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "preQualifyFlag" BOOLEAN NOT NULL DEFAULT false,
    "adopterPhone" VARCHAR(20),
    "housingType" "HousingType",
    "ownsOrRents" "OwnsOrRents",
    "landlordContact" VARCHAR(20),
    "householdSize" INTEGER,
    "numChildren" INTEGER,
    "employmentStatus" "EmploymentStatus",
    "activityLevel" "ActivityLevel",
    "yardAvailable" BOOLEAN NOT NULL DEFAULT false,
    "petExperience" "PetExperience",
    "currentPets" INTEGER NOT NULL DEFAULT 0,
    "preferredBreedID" INTEGER,
    "preferredAgeRange" "PreferredAgeRange",
    "preferredSize" "PetSize",
    "openToSpecialNeeds" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerID" VARCHAR(255),
    "accountStatus" "AdopterAccountStatus" DEFAULT 'Active',
    "addressLine1" VARCHAR(100) NOT NULL DEFAULT '',
    "addressLine2" VARCHAR(100),
    "city" VARCHAR(45) NOT NULL DEFAULT '',
    "state" VARCHAR(45) NOT NULL DEFAULT '',
    "zip" VARCHAR(10) NOT NULL DEFAULT '',
    "country" VARCHAR(45) NOT NULL DEFAULT '',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Adopter_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "adopterID" INTEGER NOT NULL,
    "petID" INTEGER NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("adopterID","petID")
);

-- CreateTable
CREATE TABLE "AdoptionApplication" (
    "applicationID" SERIAL NOT NULL,
    "applicationCode" TEXT GENERATED ALWAYS AS ('APP-' || lpad("applicationID"::text, 5, '0')) STORED,
    "petID" INTEGER NOT NULL,
    "adopterID" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffID" INTEGER,
    "shelterID" INTEGER NOT NULL,
    "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'Pending',
    "applicationType" "ApplicationType" NOT NULL DEFAULT 'Adopt',
    "shelterMessage" VARCHAR(500),
    "staffRemark" VARCHAR(300),
    "stripeCheckoutSessionID" VARCHAR(255) NOT NULL,
    "stripePaymentIntentID" VARCHAR(255),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'Paid',
    "amountPaid" DECIMAL(6,2) NOT NULL DEFAULT 15.00,

    CONSTRAINT "AdoptionApplication_pkey" PRIMARY KEY ("applicationID")
);

-- CreateTable
CREATE TABLE "Visit" (
    "visitID" SERIAL NOT NULL,
    "adopterID" INTEGER NOT NULL,
    "petID" INTEGER,
    "staffID" INTEGER,
    "shelterID" INTEGER NOT NULL,
    "visitTime" TIMESTAMP(3) NOT NULL,
    "remarks" VARCHAR(300),
    "visitStatus" "VisitStatus",

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("visitID")
);

-- CreateTable
CREATE TABLE "Notification" (
    "notificationID" SERIAL NOT NULL,
    "recipientID" INTEGER NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "notificationStatus" "NotificationStatus" NOT NULL DEFAULT 'Pending',
    "recipientType" "RecipientType" NOT NULL,
    "sendTime" TIMESTAMP(3) NOT NULL,
    "textBody" VARCHAR(300) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("notificationID")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "recordID" SERIAL NOT NULL,
    "petID" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "vetID" INTEGER,
    "recordDesc" VARCHAR(500) NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("recordID")
);

-- CreateTable
CREATE TABLE "Vaccine" (
    "vaccineID" SERIAL NOT NULL,
    "vaccineName" VARCHAR(45) NOT NULL,
    "manufacturer" VARCHAR(45),
    "vaccineDesc" VARCHAR(500),

    CONSTRAINT "Vaccine_pkey" PRIMARY KEY ("vaccineID")
);

-- CreateTable
CREATE TABLE "VaccinationRecord" (
    "recordID" SERIAL NOT NULL,
    "petID" INTEGER NOT NULL,
    "vaccineID" INTEGER NOT NULL,
    "administeredDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "administeredBy" INTEGER,
    "administeredAt" INTEGER,
    "appointmentID" INTEGER,

    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("recordID")
);

-- CreateTable
CREATE TABLE "TransferHistory" (
    "recordID" SERIAL NOT NULL,
    "petID" INTEGER NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "fromShelterID" INTEGER NOT NULL,
    "toShelterID" INTEGER NOT NULL,
    "fromShelterStaff" INTEGER,
    "toShelterStaff" INTEGER,
    "transferReason" VARCHAR(300) NOT NULL,
    "transferStatus" "TransferStatus" NOT NULL DEFAULT 'In_Progress',

    CONSTRAINT "TransferHistory_pkey" PRIMARY KEY ("recordID")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "appointmentID" SERIAL NOT NULL,
    "appointmentCode" TEXT GENERATED ALWAYS AS ('APT-' || lpad("appointmentID"::text, 5, '0')) STORED,
    "petID" INTEGER NOT NULL,
    "vetID" INTEGER NOT NULL,
    "shelterID" INTEGER NOT NULL,
    "staffID" INTEGER,
    "volunteerID" INTEGER,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentReason" VARCHAR(300) NOT NULL,
    "appointmentStatus" "AppointmentStatus" NOT NULL DEFAULT 'Scheduled',

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("appointmentID")
);

-- CreateTable
CREATE TABLE "VolunteerApplication" (
    "applicationID" SERIAL NOT NULL,
    "volunteerID" INTEGER,
    "staffID" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shelterID" INTEGER NOT NULL,
    "applicationStatus" "VolunteerAppStatus" NOT NULL DEFAULT 'Created',
    "applicationRemark" VARCHAR(100),

    CONSTRAINT "VolunteerApplication_pkey" PRIMARY KEY ("applicationID")
);

-- CreateTable
CREATE TABLE "Volunteer" (
    "userID" INTEGER NOT NULL,
    "volunteerCode" TEXT GENERATED ALWAYS AS ('VOL-' || lpad("userID"::text, 5, '0')) STORED,
    "avatarSeed" VARCHAR(64) NOT NULL,
    "volunteerName" VARCHAR(45) NOT NULL,
    "volunteerPhone" VARCHAR(20),
    "volunteerDOB" DATE,
    "volunteerSex" CHAR(1),
    "volunteerSchedule" VARCHAR(100),
    "shelterID" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountStatus" "VolunteerAccountStatus" DEFAULT 'Pending',
    "addressLine1" VARCHAR(100) NOT NULL DEFAULT '',
    "addressLine2" VARCHAR(100),
    "city" VARCHAR(45) NOT NULL DEFAULT '',
    "state" VARCHAR(45) NOT NULL DEFAULT '',
    "zip" VARCHAR(10) NOT NULL DEFAULT '',
    "country" VARCHAR(45) NOT NULL DEFAULT '',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "GovernmentID" (
    "governmentIDID" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "userType" "UserType" NOT NULL,
    "idType" VARCHAR(45) NOT NULL,
    "idNumber" VARCHAR(45) NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'Pending',
    "documentURL" VARCHAR(500),

    CONSTRAINT "GovernmentID_pkey" PRIMARY KEY ("governmentIDID")
);

-- CreateTable
CREATE TABLE "Task" (
    "taskID" SERIAL NOT NULL,
    "taskName" "TaskName" NOT NULL,
    "shelterID" INTEGER NOT NULL,
    "taskDesc" VARCHAR(300) NOT NULL,
    "taskDate" TIMESTAMP(3),
    "taskDue" TIMESTAMP(3),
    "taskStatus" "TaskStatus",
    "staffID" INTEGER,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("taskID")
);

-- CreateTable
CREATE TABLE "VolunteerTask" (
    "taskID" INTEGER NOT NULL,
    "volunteerID" INTEGER NOT NULL,

    CONSTRAINT "VolunteerTask_pkey" PRIMARY KEY ("taskID","volunteerID")
);

-- CreateTable
CREATE TABLE "Event" (
    "eventID" SERIAL NOT NULL,
    "shelterID" INTEGER NOT NULL,
    "eventName" VARCHAR(45) NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventDesc" VARCHAR(300) NOT NULL,
    "eventCategory" "EventCategory" NOT NULL,
    "staffID" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("eventID")
);

-- CreateTable
CREATE TABLE "VolunteerEvent" (
    "eventID" INTEGER NOT NULL,
    "volunteerID" INTEGER NOT NULL,

    CONSTRAINT "VolunteerEvent_pkey" PRIMARY KEY ("eventID","volunteerID")
);

-- CreateTable
CREATE TABLE "Donor" (
    "userID" INTEGER NOT NULL,
    "avatarSeed" VARCHAR(64) NOT NULL,
    "donorName" VARCHAR(45) NOT NULL,
    "donorPhone" VARCHAR(20),
    "donorDOB" DATE,
    "donorSex" CHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerID" VARCHAR(255),
    "accountStatus" "DonorAccountStatus" DEFAULT 'Active',
    "addressLine1" VARCHAR(100) NOT NULL DEFAULT '',
    "addressLine2" VARCHAR(100),
    "city" VARCHAR(45) NOT NULL DEFAULT '',
    "state" VARCHAR(45) NOT NULL DEFAULT '',
    "zip" VARCHAR(10) NOT NULL DEFAULT '',
    "country" VARCHAR(45) NOT NULL DEFAULT '',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Donation" (
    "donationID" SERIAL NOT NULL,
    "donationCode" TEXT GENERATED ALWAYS AS ('DON-' || lpad("donationID"::text, 5, '0')) STORED,
    "donorID" INTEGER NOT NULL,
    "shelterID" INTEGER NOT NULL,
    "donationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "donationAmt" DOUBLE PRECISION NOT NULL,
    "donationDesc" VARCHAR(300),

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("donationID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_userEmail_key" ON "Users"("userEmail");

-- CreateIndex
CREATE INDEX "Staff_shelterID_idx" ON "Staff"("shelterID");

-- CreateIndex
CREATE UNIQUE INDEX "Pet_petCode_key" ON "Pet"("petCode");

-- CreateIndex
CREATE INDEX "Pet_shelterID_idx" ON "Pet"("shelterID");

-- CreateIndex
CREATE INDEX "Pet_adoptionStatus_idx" ON "Pet"("adoptionStatus");

-- CreateIndex
CREATE INDEX "Pet_breedID_idx" ON "Pet"("breedID");

-- CreateIndex
CREATE UNIQUE INDEX "AdoptionApplication_applicationCode_key" ON "AdoptionApplication"("applicationCode");

-- CreateIndex
CREATE INDEX "AdoptionApplication_adopterID_idx" ON "AdoptionApplication"("adopterID");

-- CreateIndex
CREATE INDEX "AdoptionApplication_petID_idx" ON "AdoptionApplication"("petID");

-- CreateIndex
CREATE INDEX "AdoptionApplication_shelterID_idx" ON "AdoptionApplication"("shelterID");

-- CreateIndex
CREATE INDEX "VaccinationRecord_appointmentID_idx" ON "VaccinationRecord"("appointmentID");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentCode_key" ON "Appointment"("appointmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_volunteerCode_key" ON "Volunteer"("volunteerCode");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentID_userID_userType_key" ON "GovernmentID"("userID", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_donationCode_key" ON "Donation"("donationCode");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_statusChangedByID_fkey" FOREIGN KEY ("statusChangedByID") REFERENCES "Admin"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_managerStaffID_fkey" FOREIGN KEY ("managerStaffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veterinarian" ADD CONSTRAINT "Veterinarian_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veterinarian" ADD CONSTRAINT "Veterinarian_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_speciesID_fkey" FOREIGN KEY ("speciesID") REFERENCES "Species"("speciesID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_breedID_fkey" FOREIGN KEY ("breedID") REFERENCES "Breed"("breedID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPhoto" ADD CONSTRAINT "PetPhoto_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adopter" ADD CONSTRAINT "Adopter_preferredBreedID_fkey" FOREIGN KEY ("preferredBreedID") REFERENCES "Breed"("breedID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adopter" ADD CONSTRAINT "Adopter_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_adopterID_fkey" FOREIGN KEY ("adopterID") REFERENCES "Adopter"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_adopterID_fkey" FOREIGN KEY ("adopterID") REFERENCES "Adopter"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionApplication" ADD CONSTRAINT "AdoptionApplication_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_adopterID_fkey" FOREIGN KEY ("adopterID") REFERENCES "Adopter"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_vetID_fkey" FOREIGN KEY ("vetID") REFERENCES "Veterinarian"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_administeredAt_fkey" FOREIGN KEY ("administeredAt") REFERENCES "Shelter"("shelterID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_administeredBy_fkey" FOREIGN KEY ("administeredBy") REFERENCES "Veterinarian"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_vaccineID_fkey" FOREIGN KEY ("vaccineID") REFERENCES "Vaccine"("vaccineID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_appointmentID_fkey" FOREIGN KEY ("appointmentID") REFERENCES "Appointment"("appointmentID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_fromShelterID_fkey" FOREIGN KEY ("fromShelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_fromShelterStaff_fkey" FOREIGN KEY ("fromShelterStaff") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_toShelterID_fkey" FOREIGN KEY ("toShelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_toShelterStaff_fkey" FOREIGN KEY ("toShelterStaff") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_petID_fkey" FOREIGN KEY ("petID") REFERENCES "Pet"("petID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vetID_fkey" FOREIGN KEY ("vetID") REFERENCES "Veterinarian"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_volunteerID_fkey" FOREIGN KEY ("volunteerID") REFERENCES "Volunteer"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_volunteerID_fkey" FOREIGN KEY ("volunteerID") REFERENCES "Volunteer"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerTask" ADD CONSTRAINT "VolunteerTask_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "Task"("taskID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerTask" ADD CONSTRAINT "VolunteerTask_volunteerID_fkey" FOREIGN KEY ("volunteerID") REFERENCES "Volunteer"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_staffID_fkey" FOREIGN KEY ("staffID") REFERENCES "Staff"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerEvent" ADD CONSTRAINT "VolunteerEvent_eventID_fkey" FOREIGN KEY ("eventID") REFERENCES "Event"("eventID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerEvent" ADD CONSTRAINT "VolunteerEvent_volunteerID_fkey" FOREIGN KEY ("volunteerID") REFERENCES "Volunteer"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_userID_fkey" FOREIGN KEY ("userID") REFERENCES "Users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorID_fkey" FOREIGN KEY ("donorID") REFERENCES "Donor"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_shelterID_fkey" FOREIGN KEY ("shelterID") REFERENCES "Shelter"("shelterID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Not expressible in schema.prisma ────────────────────────────
-- Spatial index for /shelters/nearby's ST_DWithin filter.
CREATE INDEX "Shelter_shelterLocation_idx" ON "Shelter" USING GIST ("shelterLocation");

-- One active (Pending/Accepted) application per adopter+pet; resubmitting
-- after a Rejected/Withdrawn one is still allowed.
CREATE UNIQUE INDEX "AdoptionApplication_active_adopter_pet_key"
  ON "AdoptionApplication" ("adopterID", "petID")
  WHERE "applicationStatus" IN ('Pending', 'Accepted');

-- Double-submit guard: one Scheduled appointment per pet + vet + exact time.
CREATE UNIQUE INDEX "Appointment_pet_vet_date_scheduled_key"
  ON "Appointment" ("petID", "vetID", "appointmentDate")
  WHERE "appointmentStatus" = 'Scheduled';
