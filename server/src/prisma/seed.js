// PetPals — Seed Script
// Run with: npx prisma db seed
//
// ⚠️ WIPES THE DATABASE FIRST. Every table in the current schema (except
// Prisma's own _prisma_migrations) is truncated and its ID sequence reset,
// so every run produces exactly the same rows with exactly the same IDs.
// Storage buckets are NOT touched — pet photos and ID documents stay put and
// the rows below point at them by path.
//
// The data is chosen to cover every case the app distinguishes, not just the
// happy path: every account status for every role, every application / visit
// / appointment / transfer / task / verification status, every pet adoption
// status, a shelter per ShelterStatus, and the cross-shelter and "no shelter"
// edge cases. Each section says which cases it covers. All logins are listed
// at the bottom (and in setup/SETUP.md).
//
// Dates that matter relative to "now" (upcoming vs past, overdue, due soon)
// are computed from the current date on every run, so they stay valid.

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed: this script wipes every table (NODE_ENV=production)");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL;
if (!SUPABASE_PROJECT_URL) {
  throw new Error("SUPABASE_URL must be set in .env to seed pet photo URLs");
}
// Public base URL for the pet-images bucket — seeded pet photos are served
// directly from here. Photos uploaded through the app are stored as a bare
// object path instead (e.g. "pets/8/photo-….png"); both forms are valid.
const PET_IMAGES = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/pet-images`;

// ── Date helpers ─────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days) => new Date(Date.now() + days * DAY);

// Computes a DOB so the pet is (approximately) `years` years and `months`
// months old as of TODAY, so ages stay right on every re-seed. `refDate` only
// supplies the day-of-month, for variety.
// Built with Date.UTC, not `new Date(y, m, d)` (local midnight) — a local-time
// construction crosses into the previous UTC day on machines ahead of UTC
// (e.g. UTC+5:30), which would shift DATE columns by a day.
function dobFromAge(years, months, refDate) {
  const today = new Date();
  const day = refDate ? refDate.getUTCDate() : today.getUTCDate();
  return new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth() - months, day));
}

// Same idea for intake dates: relative to today, so the Admin Overview's
// trailing-months chart always has pets in its window.
function intakeDateMonthsAgo(monthsAgo, day) {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, day));
}

// Every shelter is in New York, so visit/appointment/event times are set as
// New York wall-clock times (e.g. 11:00 means 11am in New York), whatever
// timezone the machine running the seed is in.
const NY_TZ = "America/New_York";
const nyOffsetMs = (date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: NY_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  );
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    date.getTime()
  );
};
const nyAt = (days, hour, minute = 0) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: NY_TZ })
    .format(daysFromNow(days))
    .split("-")
    .map(Number);
  const wallClockAsUTC = Date.UTC(y, m - 1, d, hour, minute);
  return new Date(wallClockAsUTC - nyOffsetMs(new Date(wallClockAsUTC)));
};

// ── Account helpers ──────────────────────────────────────────────
const hashCache = {};
const hash = async (password) => (hashCache[password] ??= await bcrypt.hash(password, 10));

// Creates the Users row; the caller creates the matching role row.
const createUser = async (email, password, role, { emailVerified = true, lastLoginAt = null } = {}) =>
  prisma.users.create({
    data: { userEmail: email, userPassword: await hash(password), role, emailVerified, lastLoginAt },
  });

// Filled-in profile basics shared by the role tables (structured address +
// onboarding progress).
const address = (addressLine1, city, state, zip, addressLine2 = null) => ({
  addressLine1,
  addressLine2,
  city,
  state,
  zip,
  country: "United States",
});
const ONBOARDED = { onboardingComplete: true, onboardingStep: 7 };
const avatar = () => crypto.randomUUID();

const logins = [];
const login = (role, email, password, note) => logins.push({ role, email, password, note });

async function wipe() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  console.log("🌱 Seeding PetPals database...");
  console.log("Wiping existing data...");
  await wipe();

  // ── SHELTERS ─────────────────────────────────────────────────
  // One per ShelterStatus. Downtown and Brooklyn are the working shelters
  // (each with its own manager, so cross-shelter isolation is visible).
  // Queens is Full with no manager — the case where vets can't register
  // there and a Manager sign-up awaits Admin approval. Harlem is Closed and
  // empty (hidden from the public shelter list).
  console.log("Creating shelters...");
  const shelterRows = [
    {
      shelterName: "PetPals Downtown",
      shelterAddress: "123 Main Street, New York, NY 10001",
      shelterPhone: "+12125550101",
      shelterEmail: "downtown@petpals.com",
      shelterZIP: 10001,
      shelterSize: 50,
      shelterStatus: "Open",
      lng: -73.9965,
      lat: 40.7505,
    },
    {
      shelterName: "PetPals Brooklyn",
      shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
      shelterPhone: "+17185550202",
      shelterEmail: "brooklyn@petpals.com",
      shelterZIP: 11201,
      shelterSize: 40,
      shelterStatus: "Open",
      lng: -73.9903,
      lat: 40.6943,
    },
    {
      shelterName: "PetPals Queens",
      shelterAddress: "27-01 Queens Plaza N, Queens, NY 11101",
      shelterPhone: "+17185550303",
      shelterEmail: "queens@petpals.com",
      shelterZIP: 11101,
      shelterSize: 20,
      shelterStatus: "Full",
      lng: -73.9387,
      lat: 40.7447,
    },
    {
      shelterName: "PetPals Harlem",
      shelterAddress: "200 W 125th Street, New York, NY 10027",
      shelterPhone: "+12125550404",
      shelterEmail: "harlem@petpals.com",
      shelterZIP: 10027,
      shelterSize: 30,
      shelterStatus: "Closed",
      lng: -73.9533,
      lat: 40.8116,
    },
  ];
  const shelters = [];
  for (const { lng, lat, ...data } of shelterRows) {
    const shelter = await prisma.shelter.create({ data });
    // PostGIS point — lng first. Prisma can't write geography columns.
    await prisma.$executeRaw`
      UPDATE "Shelter" SET "shelterLocation" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE "shelterID" = ${shelter.shelterID}`;
    shelters.push(shelter);
  }
  const [shelter1, shelter2, shelter3] = shelters;

  // ── CORE LOGINS (one per role) ───────────────────────────────
  // Created first and in this order so they keep userIDs 1–6.
  console.log("Creating accounts...");
  const recent = daysFromNow(-1);

  // Admin — the first admin ever registered auto-activates.
  const adminUser = await createUser("admin@petpals.com", "Admin@123", "Admin", { lastLoginAt: recent });
  await prisma.admin.create({
    data: {
      userID: adminUser.userID,
      adminName: "Isabella Martinez",
      avatarSeed: avatar(),
      adminPhone: "+12125550102",
      adminDOB: new Date("1985-11-02"),
      adminSex: "F",
      ...address("456 Elm Street", "New York", "NY", "10001"),
      ...ONBOARDED,
      accountStatus: "Active",
    },
  });
  login("Admin", "admin@petpals.com", "Admin@123", "Active");

  // Staff — Downtown's manager (Manager designation and
  // Shelter.managerStaffID always agree).
  const staffUser = await createUser("staff@petpals.com", "Staff@123", "Staff", { lastLoginAt: recent });
  const sasha = await prisma.staff.create({
    data: {
      userID: staffUser.userID,
      staffName: "Sasha Grey",
      avatarSeed: avatar(),
      staffPhone: "+12125550103",
      shelterID: shelter1.shelterID,
      staffDOB: new Date("1988-03-15"),
      staffSex: "F",
      staffDOJ: new Date("2020-01-10"),
      staffDesignation: "Manager",
      accountStatus: "Active",
      ...address("88 Greenwich Street", "New York", "NY", "10006", "Apt 12C"),
      ...ONBOARDED,
    },
  });
  login("Staff", "staff@petpals.com", "Staff@123", "Active — Manager, PetPals Downtown");

  const vetUser = await createUser("vet@petpals.com", "Vet@123", "Veterinarian", { lastLoginAt: recent });
  const vet = await prisma.veterinarian.create({
    data: {
      userID: vetUser.userID,
      vetName: "Jay Asarathi",
      avatarSeed: avatar(),
      vetPhone: "+12125550104",
      vetDOB: new Date("1980-07-22"),
      vetSex: "M",
      shelterID: shelter1.shelterID,
      accountStatus: "Active",
      ...address("789 Oak Lane", "New York", "NY", "10002"),
      ...ONBOARDED,
    },
  });
  login("Veterinarian", "vet@petpals.com", "Vet@123", "Active — PetPals Downtown");

  // Adopter — the fully-featured one: onboarded, ID verified, adopted Buddy,
  // an application in every status, favorites, visits, appointments.
  const adopterUser = await createUser("adopter@petpals.com", "Adopter@123", "Adopter", {
    lastLoginAt: recent,
  });
  const emelie = await prisma.adopter.create({
    data: {
      userID: adopterUser.userID,
      adopterName: "Emelie A. Archer",
      avatarSeed: avatar(),
      adopterPhone: "+12125550105",
      adopterDOB: new Date("1998-11-06"),
      adopterSex: "F",
      preQualifyFlag: true,
      housingType: "Apartment",
      ownsOrRents: "Owns",
      householdSize: 2,
      numChildren: 0,
      employmentStatus: "Employed",
      activityLevel: "Active",
      yardAvailable: false,
      petExperience: "Little",
      currentPets: 0,
      preferredAgeRange: "Young",
      preferredSize: "Small",
      openToSpecialNeeds: false,
      accountStatus: "Active",
      ...address("12 Bleecker Street", "New York", "NY", "10012", "Apt 4B"),
      ...ONBOARDED,
    },
  });
  login("Adopter", "adopter@petpals.com", "Adopter@123", "Active — onboarded, ID verified, adopted Buddy");

  const volunteerUser = await createUser("volunteer@petpals.com", "Volunteer@123", "Volunteer", {
    lastLoginAt: recent,
  });
  const bryan = await prisma.volunteer.create({
    data: {
      userID: volunteerUser.userID,
      volunteerName: "Bryan Smith",
      avatarSeed: avatar(),
      volunteerPhone: "+12125550106",
      volunteerDOB: new Date("2005-09-18"),
      volunteerSex: "M",
      volunteerSchedule: "Weekends 9am-5pm",
      shelterID: shelter1.shelterID,
      accountStatus: "Active",
      ...address("321 Elm Street", "New York", "NY", "10013"),
      ...ONBOARDED,
    },
  });
  login("Volunteer", "volunteer@petpals.com", "Volunteer@123", "Active — PetPals Downtown");

  const donorUser = await createUser("donor@petpals.com", "Donor@123", "Donor", { lastLoginAt: recent });
  const charlotte = await prisma.donor.create({
    data: {
      userID: donorUser.userID,
      donorName: "Charlotte Salazar",
      avatarSeed: avatar(),
      donorPhone: "+12125550107",
      donorDOB: new Date("1958-04-30"),
      donorSex: "F",
      accountStatus: "Active",
      ...address("654 Pine Road", "New York", "NY", "10014"),
      ...ONBOARDED,
    },
  });
  login("Donor", "donor@petpals.com", "Donor@123", "Active");

  // ── ADMINS: every AdminAccountStatus ─────────────────────────
  // Pending: a later self-registration awaiting approval by an existing admin.
  // Deactivated: carries the audit trail of which admin deactivated them.
  const adminPendingUser = await createUser("admin.pending@petpals.com", "Admin@123", "Admin", {
    emailVerified: false,
  });
  await prisma.admin.create({
    data: {
      userID: adminPendingUser.userID,
      adminName: "Henry Walsh",
      avatarSeed: avatar(),
      accountStatus: "Pending",
    },
  });
  login("Admin", "admin.pending@petpals.com", "Admin@123", "Pending — can't log in until approved");

  const adminDeactivatedUser = await createUser("admin.deactivated@petpals.com", "Admin@123", "Admin", {
    lastLoginAt: daysFromNow(-120),
  });
  await prisma.admin.create({
    data: {
      userID: adminDeactivatedUser.userID,
      adminName: "Olivia Grant",
      avatarSeed: avatar(),
      adminPhone: "+12125550110",
      ...address("9 Hudson Street", "New York", "NY", "10013"),
      ...ONBOARDED,
      accountStatus: "Deactivated",
      statusChangedByID: adminUser.userID,
      statusChangedAt: daysFromNow(-90),
    },
  });
  login("Admin", "admin.deactivated@petpals.com", "Admin@123", "Deactivated by Isabella");

  // ── STAFF: every designation + status, both shelters, no shelter ──
  const createStaff = async (email, data, userOpts) => {
    const user = await createUser(email, "Staff@123", "Staff", userOpts);
    return prisma.staff.create({ data: { userID: user.userID, avatarSeed: avatar(), ...data } });
  };
  const daniel = await createStaff(
    "staff.senior@petpals.com",
    {
      staffName: "Daniel Kim",
      staffPhone: "+12125550111",
      shelterID: shelter1.shelterID,
      staffDOB: new Date("1991-06-02"),
      staffSex: "M",
      staffDOJ: new Date("2022-04-01"),
      staffDesignation: "Senior",
      accountStatus: "Active",
      ...address("40 Water Street", "New York", "NY", "10004"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-2) },
  );
  login("Staff", "staff.senior@petpals.com", "Staff@123", "Active — Senior, Downtown");

  await createStaff(
    "staff.associate@petpals.com",
    {
      staffName: "Priya Nair",
      staffPhone: "+12125550112",
      shelterID: shelter1.shelterID,
      staffDOB: new Date("1998-01-20"),
      staffSex: "F",
      staffDOJ: new Date("2025-02-15"),
      staffDesignation: "Associate",
      accountStatus: "Active",
      ...address("15 Broad Street", "New York", "NY", "10005"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-3) },
  );
  login("Staff", "staff.associate@petpals.com", "Staff@123", "Active — Associate, Downtown");

  // Pending non-manager sign-up: approved by Downtown's manager (Staff tab).
  await createStaff(
    "staff.pending@petpals.com",
    {
      staffName: "Omar Haddad",
      staffPhone: "+12125550113",
      shelterID: shelter1.shelterID,
      staffDesignation: "Associate",
      accountStatus: "Pending",
    },
    { emailVerified: false },
  );
  login("Staff", "staff.pending@petpals.com", "Staff@123", "Pending Associate — Downtown manager approves");

  // Pending Manager sign-up at a manager-less shelter: Admin approves.
  await createStaff(
    "staff.manager.pending@petpals.com",
    {
      staffName: "Grace Liu",
      staffPhone: "+17185550114",
      shelterID: shelter3.shelterID,
      staffDesignation: "Manager",
      accountStatus: "Pending",
    },
    { emailVerified: false },
  );
  login("Staff", "staff.manager.pending@petpals.com", "Staff@123", "Pending Manager — Queens, Admin approves");

  // Deactivated after having joined: both DOJ and DOS stamped.
  await createStaff(
    "staff.deactivated@petpals.com",
    {
      staffName: "Tom Becker",
      staffPhone: "+12125550115",
      shelterID: shelter1.shelterID,
      staffDOB: new Date("1985-09-09"),
      staffSex: "M",
      staffDOJ: new Date("2021-03-01"),
      staffDOS: daysFromNow(-60),
      staffDesignation: "Senior",
      accountStatus: "Deactivated",
      ...address("70 Pine Street", "New York", "NY", "10005"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-65) },
  );
  login("Staff", "staff.deactivated@petpals.com", "Staff@123", "Deactivated");

  // Brooklyn's manager — the "other shelter" for isolation checks.
  const marcus = await createStaff(
    "brooklyn.staff@petpals.com",
    {
      staffName: "Marcus Lee",
      staffPhone: "+17185550116",
      shelterID: shelter2.shelterID,
      staffDOB: new Date("1987-12-11"),
      staffSex: "M",
      staffDOJ: new Date("2021-08-16"),
      staffDesignation: "Manager",
      accountStatus: "Active",
      ...address("300 Atlantic Avenue", "Brooklyn", "NY", "11201"),
      ...ONBOARDED,
    },
    { lastLoginAt: recent },
  );
  login("Staff", "brooklyn.staff@petpals.com", "Staff@123", "Active — Manager, PetPals Brooklyn");

  // Active but not assigned to any shelter (e.g. moved off one by an Admin):
  // shelter-scoped lists come back empty and creating tasks is refused.
  await createStaff(
    "staff.unassigned@petpals.com",
    {
      staffName: "Elena Rossi",
      staffPhone: "+12125550117",
      shelterID: null,
      staffDOJ: new Date("2023-05-22"),
      accountStatus: "Active",
      ...address("5 Beekman Street", "New York", "NY", "10038"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-7) },
  );
  login("Staff", "staff.unassigned@petpals.com", "Staff@123", "Active — no shelter assigned");

  await prisma.shelter.update({ where: { shelterID: shelter1.shelterID }, data: { managerStaffID: sasha.userID } });
  await prisma.shelter.update({ where: { shelterID: shelter2.shelterID }, data: { managerStaffID: marcus.userID } });

  // ── VETERINARIANS: every VetAccountStatus ────────────────────
  const createVet = async (email, data, userOpts) => {
    const user = await createUser(email, "Vet@123", "Veterinarian", userOpts);
    return prisma.veterinarian.create({ data: { userID: user.userID, avatarSeed: avatar(), ...data } });
  };
  const amara = await createVet(
    "vet.brooklyn@petpals.com",
    {
      vetName: "Amara Okafor",
      vetPhone: "+17185550118",
      vetDOB: new Date("1983-02-27"),
      vetSex: "F",
      shelterID: shelter2.shelterID,
      accountStatus: "Active",
      ...address("120 Court Street", "Brooklyn", "NY", "11201"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-4) },
  );
  login("Veterinarian", "vet.brooklyn@petpals.com", "Vet@123", "Active — PetPals Brooklyn");

  await createVet(
    "vet.pending@petpals.com",
    { vetName: "Sam Patel", vetPhone: "+12125550119", shelterID: shelter1.shelterID, accountStatus: "Pending" },
    { emailVerified: false },
  );
  login("Veterinarian", "vet.pending@petpals.com", "Vet@123", "Pending — Downtown manager approves (Vets tab)");

  await createVet(
    "vet.deactivated@petpals.com",
    {
      vetName: "Lena Fischer",
      vetPhone: "+12125550120",
      vetDOB: new Date("1976-10-03"),
      vetSex: "F",
      shelterID: shelter1.shelterID,
      accountStatus: "Deactivated",
      ...address("25 Park Row", "New York", "NY", "10038"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-200) },
  );
  login("Veterinarian", "vet.deactivated@petpals.com", "Vet@123", "Deactivated");

  // ── ADOPTERS: every AdopterAccountStatus + mid-onboarding ────
  const createAdopter = async (email, data, userOpts) => {
    const user = await createUser(email, "Adopter@123", "Adopter", userOpts);
    return prisma.adopter.create({ data: { userID: user.userID, avatarSeed: avatar(), ...data } });
  };

  // Species/breeds are needed for Noah's preferredBreedID — created further
  // down, so his preference is set after the breeds exist.
  const noah = await createAdopter(
    "adopter.two@petpals.com",
    {
      adopterName: "Noah Bennett",
      adopterPhone: "+17185550121",
      adopterDOB: new Date("1989-04-14"),
      adopterSex: "M",
      housingType: "House",
      ownsOrRents: "Owns",
      householdSize: 4,
      numChildren: 2,
      employmentStatus: "Self_employed",
      activityLevel: "Medium",
      yardAvailable: true,
      petExperience: "Very",
      currentPets: 1,
      preferredAgeRange: "Adult",
      preferredSize: "Large",
      openToSpecialNeeds: true,
      accountStatus: "Active",
      ...address("48 Prospect Park West", "Brooklyn", "NY", "11215"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-2) },
  );
  login("Adopter", "adopter.two@petpals.com", "Adopter@123", "Active — adopted Shadow, fostering Hazel, ID pending");

  // Stopped partway through onboarding (step 4 of the wizard): basics
  // filled in, household/lifestyle not yet, no government ID.
  await createAdopter(
    "adopter.onboarding@petpals.com",
    {
      adopterName: "Ava Thompson",
      adopterPhone: "+12125550122",
      adopterDOB: new Date("2001-07-30"),
      adopterSex: "F",
      accountStatus: "Active",
      ...address("210 E 23rd Street", "New York", "NY", "10010"),
      onboardingComplete: false,
      onboardingStep: 4,
    },
    { emailVerified: false, lastLoginAt: daysFromNow(-1) },
  );
  login("Adopter", "adopter.onboarding@petpals.com", "Adopter@123", "Active — onboarding incomplete (step 4)");

  const riley = await createAdopter(
    "adopter.banned@petpals.com",
    {
      adopterName: "Riley Carter",
      adopterPhone: "+17185550123",
      adopterDOB: new Date("1994-03-08"),
      adopterSex: "M",
      adopterRiskFlag: true,
      housingType: "Apartment",
      ownsOrRents: "Rents",
      landlordContact: "+17185550124",
      householdSize: 1,
      numChildren: 0,
      employmentStatus: "Unemployed",
      activityLevel: "Sedentary",
      petExperience: "No",
      accountStatus: "Banned",
      ...address("77 Nostrand Avenue", "Brooklyn", "NY", "11216"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-30) },
  );
  login("Adopter", "adopter.banned@petpals.com", "Adopter@123", "Banned — risk-flagged, ID rejected");

  await createAdopter(
    "adopter.deactivated@petpals.com",
    {
      adopterName: "Jordan Price",
      adopterPhone: "+12125550125",
      adopterDOB: new Date("1996-12-19"),
      adopterSex: "O",
      housingType: "Other",
      ownsOrRents: "Rents",
      householdSize: 3,
      numChildren: 1,
      employmentStatus: "Student",
      activityLevel: "Medium",
      petExperience: "Some",
      preferredAgeRange: "Old",
      preferredSize: "Medium",
      accountStatus: "Deactivated",
      ...address("500 W 110th Street", "New York", "NY", "10025"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-150) },
  );
  login("Adopter", "adopter.deactivated@petpals.com", "Adopter@123", "Deactivated (closed own account)");

  // ── VOLUNTEERS: every VolunteerAccountStatus ─────────────────
  const createVolunteer = async (email, data, userOpts, password = "Volunteer@123") => {
    const user = await createUser(email, password, "Volunteer", userOpts);
    return prisma.volunteer.create({ data: { userID: user.userID, avatarSeed: avatar(), ...data } });
  };
  const maya = await createVolunteer(
    "volunteer.two@petpals.com",
    {
      volunteerName: "Maya Chen",
      volunteerPhone: "+12125550126",
      volunteerDOB: new Date("2000-05-05"),
      volunteerSex: "F",
      volunteerSchedule: "Weekday evenings",
      shelterID: shelter1.shelterID,
      accountStatus: "Active",
      ...address("33 Bond Street", "New York", "NY", "10012"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-1) },
  );
  login("Volunteer", "volunteer.two@petpals.com", "Volunteer@123", "Active — Downtown");

  const leo = await createVolunteer(
    "volunteer.pending@petpals.com",
    { volunteerName: "Leo Martins", volunteerPhone: "+12125550127", shelterID: shelter1.shelterID, accountStatus: "Pending" },
    { emailVerified: false },
  );
  login("Volunteer", "volunteer.pending@petpals.com", "Volunteer@123", "Pending — Downtown staff approve");

  const nina = await createVolunteer(
    "volunteer.banned@petpals.com",
    {
      volunteerName: "Nina Park",
      volunteerPhone: "+12125550128",
      volunteerDOB: new Date("1999-08-21"),
      volunteerSex: "F",
      shelterID: shelter1.shelterID,
      accountStatus: "Banned",
      ...address("11 Mott Street", "New York", "NY", "10013"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-45) },
  );
  login("Volunteer", "volunteer.banned@petpals.com", "Volunteer@123", "Banned");

  await createVolunteer(
    "volunteer.deactivated@petpals.com",
    {
      volunteerName: "Ethan Cole",
      volunteerPhone: "+12125550129",
      volunteerDOB: new Date("1997-11-11"),
      volunteerSex: "M",
      volunteerSchedule: "Saturdays",
      shelterID: shelter1.shelterID,
      accountStatus: "Deactivated",
      ...address("60 Wall Street", "New York", "NY", "10005"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-100) },
  );
  login("Volunteer", "volunteer.deactivated@petpals.com", "Volunteer@123", "Deactivated");

  const zoe = await createVolunteer(
    "volunteer.brooklyn@petpals.com",
    {
      volunteerName: "Zoe Alvarez",
      volunteerPhone: "+17185550130",
      volunteerDOB: new Date("2003-02-14"),
      volunteerSex: "F",
      volunteerSchedule: "Sundays",
      shelterID: shelter2.shelterID,
      accountStatus: "Active",
      ...address("150 Smith Street", "Brooklyn", "NY", "11201"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-5) },
  );
  login("Volunteer", "volunteer.brooklyn@petpals.com", "Volunteer@123", "Active — Brooklyn");

  // ── DONORS: every DonorAccountStatus ─────────────────────────
  const createDonor = async (email, data, userOpts) => {
    const user = await createUser(email, "Donor@123", "Donor", userOpts);
    return prisma.donor.create({ data: { userID: user.userID, avatarSeed: avatar(), ...data } });
  };
  const jane = await createDonor("jane.smith@petpals.com", {
    donorName: "Jane Smith",
    donorPhone: "+12125550108",
    accountStatus: "Active",
  });
  const tammy = await createDonor("tammy.sings@petpals.com", {
    donorName: "Tammy Sings",
    donorPhone: "+17185550109",
    accountStatus: "Active",
  });
  login("Donor", "jane.smith@petpals.com", "Donor@123", "Active — minimal profile");
  login("Donor", "tammy.sings@petpals.com", "Donor@123", "Active — minimal profile");
  const victor = await createDonor(
    "donor.banned@petpals.com",
    { donorName: "Victor Hale", donorPhone: "+12125550131", accountStatus: "Banned" },
    { lastLoginAt: daysFromNow(-80) },
  );
  login("Donor", "donor.banned@petpals.com", "Donor@123", "Banned");
  const rosa = await createDonor(
    "donor.deactivated@petpals.com",
    {
      donorName: "Rosa Diaz",
      donorPhone: "+17185550132",
      donorDOB: new Date("1970-06-06"),
      donorSex: "F",
      accountStatus: "Deactivated",
      ...address("9 Clinton Street", "Brooklyn", "NY", "11201"),
      ...ONBOARDED,
    },
    { lastLoginAt: daysFromNow(-300) },
  );
  login("Donor", "donor.deactivated@petpals.com", "Donor@123", "Deactivated");

  // ── SPECIES & BREEDS ─────────────────────────────────────────
  // Reptile / Leopard Gecko has no pets: a filter option that matches nothing.
  console.log("Creating species and breeds...");
  const speciesBreeds = {
    Dog: ["German Shepherd", "Golden Retriever", "Beagle", "Labrador", "Bulldog", "Rottweiler", "Toy Poodle"],
    Cat: ["Siamese", "Domestic Shorthair", "British Shorthair", "Persian", "Maine Coon"],
    Bird: ["Parrot", "Blue Macaw", "Pigeon"],
    Rabbit: ["Holland Lop"],
    Reptile: ["Leopard Gecko"],
  };
  const breed = {};
  for (const [speciesName, breedNames] of Object.entries(speciesBreeds)) {
    const species = await prisma.species.create({ data: { speciesName } });
    for (const breedName of breedNames) {
      breed[breedName] = (await prisma.breed.create({ data: { speciesID: species.speciesID, breedName } })).breedID;
    }
  }
  await prisma.adopter.update({ where: { userID: noah.userID }, data: { preferredBreedID: breed["Golden Retriever"] } });

  // ── VACCINES ─────────────────────────────────────────────────
  console.log("Creating vaccines...");
  const vaccineRows = [
    { vaccineName: "DHPP", manufacturer: "Zoetis", vaccineDesc: "Distemper, hepatitis, parainfluenza and parvovirus — core canine vaccine." },
    { vaccineName: "Rabies", manufacturer: "Boehringer", vaccineDesc: null },
    { vaccineName: "Bordetella", manufacturer: "Merck", vaccineDesc: "Kennel cough." },
    { vaccineName: "FVRCP", manufacturer: null, vaccineDesc: "Core feline vaccine." },
  ];
  const vaccine = {};
  for (const data of vaccineRows) vaccine[data.vaccineName] = (await prisma.vaccine.create({ data })).vaccineID;

  // ── PETS ─────────────────────────────────────────────────────
  // Pets 1–18 are the long-standing catalog (same order, so same IDs as
  // before). 19–21 cover the remaining AdoptionStatus values: fostered,
  // incoming, deceased. featuredFlag drives the Home "Featured Pets" slider
  // (which only shows the available ones). Pets are attributed to their own
  // shelter's staff; Mischief was added by an Admin, so has no staffID.
  console.log("Creating pets...");
  const D = shelter1.shelterID;
  const B = shelter2.shelterID;
  const pets = [
    {
      petName: "Apollo",
      breedID: breed["German Shepherd"],
      petDOB: dobFromAge(4, 0, new Date("2024-03-10")),
      petWeight: 32.0,
      petHeight: 62.0,
      petBGroup: "DEA4",
      petColor: "Black and Tan",
      petSize: "Large",
      petPhoto: `${PET_IMAGES}/1.png`,
      petSex: "M",
      petDesc:
        "Apollo is a confident and loyal German Shepherd who takes his role as protector seriously. He thrives with experienced owners who can match his intelligence and energy. Best suited as the only pet in the home.",
      intakeDate: intakeDateMonthsAgo(11, 10),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Buddy",
      breedID: breed["Golden Retriever"],
      petDOB: dobFromAge(2, 0, new Date("2024-06-01")),
      petWeight: 28.5,
      petHeight: 58.0,
      petBGroup: "DEA1",
      petColor: "Golden",
      petSize: "Large",
      petPhoto: `${PET_IMAGES}/2.png`,
      petSex: "M",
      petDesc:
        "Buddy is the definition of a family dog — endlessly cheerful, gentle with kids, and a best friend to every dog he meets. He loves fetch, swimming, and curling up on the couch after a long walk.",
      microchipID: "985141000000002",
      intakeDate: intakeDateMonthsAgo(8, 1),
      intakeType: "stray",
      adoptionStatus: "adopted", // by Emelie (Accepted application below)
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Biscuit",
      breedID: breed["Beagle"],
      petDOB: dobFromAge(6, 0, new Date("2024-01-20")),
      petWeight: 10.5,
      petHeight: 38.0,
      petBGroup: "DEA3",
      petColor: "Tricolor",
      petSize: "Medium",
      petPhoto: `${PET_IMAGES}/3.png`,
      petSex: "M",
      petDesc:
        "Biscuit is a nose-to-the-ground explorer who never meets a smell he doesn't investigate. Calm and affectionate at home, he loves children and is happiest on long morning walks.",
      intakeDate: intakeDateMonthsAgo(14, 20),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Daisy",
      breedID: breed["Labrador"],
      petDOB: dobFromAge(1, 0, new Date("2024-08-15")),
      petWeight: 22.0,
      petHeight: 55.0,
      petBGroup: "DEA1",
      petColor: "Yellow",
      petSize: "Medium",
      petPhoto: `${PET_IMAGES}/4.png`,
      petSex: "F",
      petDesc:
        "Daisy is a bouncy young Lab who is still learning the ropes. She is eager to please and picks up new commands quickly. She adores children and other dogs — the more the merrier.",
      intakeDate: intakeDateMonthsAgo(6, 15),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Rocky",
      breedID: breed["Bulldog"],
      petDOB: dobFromAge(8, 0, new Date("2023-11-05")),
      petWeight: 24.0,
      petHeight: 40.0,
      petBGroup: "DEA4",
      petColor: "Brindle",
      petSize: "Medium",
      petPhoto: `${PET_IMAGES}/5.png`,
      petSex: "M",
      petDesc:
        "Rocky is a laid-back senior Bulldog who asks for little more than a comfy sofa and a patient owner. He has a mild heart condition that requires monthly vet visits but is otherwise healthy and full of personality.",
      intakeDate: intakeDateMonthsAgo(15, 5),
      intakeType: "surrendered",
      adoptionStatus: "transferred", // held here while his outgoing transfer is In_Progress
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: true,
      featuredFlag: true,
    },
    {
      petName: "Zeus",
      breedID: breed["Rottweiler"],
      petDOB: dobFromAge(3, 0, new Date("2024-04-22")),
      petWeight: 45.0,
      petHeight: 65.0,
      petBGroup: "DEA3",
      petColor: "Black and Mahogany",
      petSize: "Large",
      petPhoto: `${PET_IMAGES}/6.png`,
      petSex: "M",
      petDesc:
        "Zeus is a powerful and disciplined Rottweiler who is deeply loyal to those he trusts. He requires an experienced handler and a home without other animals. With the right owner, he is an incredibly devoted companion.",
      intakeDate: intakeDateMonthsAgo(10, 22),
      intakeType: "surrendered",
      adoptionStatus: "transferred", // held here while his transfer to Downtown is In_Progress
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Teddy",
      breedID: breed["Toy Poodle"],
      petDOB: dobFromAge(0, 4, null),
      petWeight: 1.2,
      petHeight: 18.0,
      petBGroup: "DEA1",
      petColor: "Apricot",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/7.png`,
      petSex: "M",
      petDesc:
        "Teddy is a fluffy 4-month-old Toy Poodle puppy who is curious about everything and afraid of nothing. He is still learning basic commands and would thrive with a patient first-time owner. Gets along wonderfully with kids and other pets.",
      intakeDate: intakeDateMonthsAgo(1, 1),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Cleo",
      breedID: breed["Siamese"],
      petDOB: dobFromAge(3, 0, new Date("2024-05-10")),
      petWeight: 4.2,
      petHeight: 28.0,
      petBGroup: "AB",
      petColor: "Seal Point",
      petSize: "Small",
      petPhoto: "pets/8/photo-1789752882891.png", // replaced through the staff UI
      petSex: "F",
      petDesc:
        "Cleo is a vocal and opinionated Siamese who knows exactly what she wants. She forms deep bonds with her person but prefers to be the only animal in the home. Perfect for someone who wants a cat with real personality.",
      intakeDate: intakeDateMonthsAgo(9, 10),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: false,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Mittens",
      breedID: breed["Domestic Shorthair"],
      petDOB: dobFromAge(5, 0, new Date("2023-09-14")),
      petWeight: 4.8,
      petHeight: 25.0,
      petBGroup: "A",
      petColor: "White and Grey",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/9.png`,
      petSex: "F",
      petDesc:
        "Mittens is a gentle and easygoing cat who gets along with everyone — children, dogs, other cats. She loves sunny windowsills and will happily sit on a lap for hours. A wonderful first cat for any household.",
      intakeDate: intakeDateMonthsAgo(17, 14),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Shadow",
      breedID: breed["British Shorthair"],
      petDOB: dobFromAge(7, 0, new Date("2023-06-01")),
      petWeight: 5.5,
      petHeight: 30.0,
      petBGroup: "B",
      petColor: "Blue Grey",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/10.png`,
      petSex: "M",
      petDesc:
        "Shadow found his forever home and is now thriving with his new family. A calm and dignified British Shorthair who won everyone over with his quiet affection.",
      microchipID: "985141000000010",
      intakeDate: intakeDateMonthsAgo(18, 1),
      intakeType: "surrendered",
      adoptionStatus: "adopted", // by Noah (Accepted application below)
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Mochi",
      breedID: breed["Persian"],
      petDOB: dobFromAge(0, 3, null),
      petWeight: 0.8,
      petHeight: 15.0,
      petBGroup: "A",
      petColor: "Cream",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/11.png`,
      petSex: "F",
      petDesc:
        "Mochi is a 3-month-old Persian kitten with a cloud-like coat and the most expressive eyes. She is playful and sociable, already comfortable around children and other pets. She will need regular grooming.",
      microchipID: "A159B00DZB119",
      intakeDate: intakeDateMonthsAgo(0, 15),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Simba",
      breedID: breed["Maine Coon"],
      petDOB: dobFromAge(1, 0, new Date("2024-10-08")),
      petWeight: 5.0,
      petHeight: 32.0,
      petBGroup: "AB",
      petColor: "Brown Tabby",
      petSize: "Medium",
      petPhoto: `${PET_IMAGES}/12.png`,
      petSex: "M",
      petDesc:
        "Simba is a playful young Maine Coon who thinks he is much bigger than he is. He is endlessly curious, loves to climb, and chirps at birds through the window. Great with kids and other cats.",
      intakeDate: intakeDateMonthsAgo(4, 8),
      intakeType: "stray",
      adoptionStatus: "available", // arrived from Downtown via a Completed transfer
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Polly",
      breedID: breed["Parrot"],
      petDOB: dobFromAge(10, 0, new Date("2024-02-14")),
      petWeight: 0.5,
      petHeight: 30.0,
      petBGroup: "N/A",
      petPhoto: `${PET_IMAGES}/13.png`,
      petColor: "Green and Red",
      petSize: "Small",
      petSex: "F",
      petDesc:
        "Polly is a remarkably intelligent 10-year-old parrot with a vocabulary of over 50 words. She needs mental stimulation, daily interaction, and a quiet home environment. Not suitable for homes with young children.",
      intakeDate: intakeDateMonthsAgo(12, 14),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Bloo",
      breedID: breed["Blue Macaw"],
      petDOB: dobFromAge(6, 0, new Date("2024-07-30")),
      petWeight: 1.2,
      petHeight: 75.0,
      petBGroup: "N/A",
      petColor: "Blue",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/14.png`,
      petSex: "M",
      petDesc:
        "Bloo is a stunning Blue Macaw with a bold personality to match his striking plumage. He is social and vocal, and bonds deeply with his owner. Requires an experienced bird owner and a large enclosure.",
      intakeDate: intakeDateMonthsAgo(7, 30),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Nimbus",
      breedID: breed["Pigeon"],
      petDOB: dobFromAge(2, 0, new Date("2024-09-05")),
      petWeight: 0.4,
      petHeight: 32.0,
      petBGroup: "N/A",
      petColor: "Grey and White",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/15.png`,
      petSex: "M",
      petDesc:
        "Nimbus is a rescue pigeon who was found injured and nursed back to health. He is calm, gentle and surprisingly affectionate. He gets along well with other birds and is a wonderful low-maintenance companion.",
      intakeDate: intakeDateMonthsAgo(5, 5),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Sky",
      breedID: breed["Pigeon"],
      petDOB: dobFromAge(1, 0, new Date("2025-01-20")),
      petWeight: 0.35,
      petHeight: 30.0,
      petBGroup: "N/A",
      petColor: "White",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/16.png`,
      petSex: "F",
      petDesc:
        "Sky is a young white pigeon with a calm and trusting nature. She was rescued from a city rooftop and has since become very comfortable around people. A peaceful and easy companion for the right home.",
      intakeDate: intakeDateMonthsAgo(2, 20),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Pebbles",
      breedID: breed["Holland Lop"],
      petDOB: dobFromAge(2, 0, new Date("2024-11-12")),
      petWeight: 1.8,
      petHeight: 20.0,
      petBGroup: "N/A",
      petColor: "Grey and White",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/17.png`,
      petSex: "F",
      petDesc:
        "Pebbles is a sweet Holland Lop rabbit who loves to binky around the room and then flop dramatically by your feet. She is litter trained, gentle with children, and gets along well with other small animals.",
      intakeDate: intakeDateMonthsAgo(3, 12),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    {
      petName: "Mischief",
      breedID: breed["Golden Retriever"],
      petDOB: new Date("2024-11-13"),
      petWeight: 26,
      petHeight: 106,
      petBGroup: "AB1",
      petColor: "Golden Brown",
      petSize: "Large",
      petPhoto: "pets/771/photo-1790401452715.png", // uploaded through the staff UI
      petSex: "M",
      petDesc:
        "Mischief, as is name suggests, is a lover of shenanigans. Though he is always eager for adventures, he is very loving and disciplined (with a few treatos of course). He has a bright aura, always keeping everyone around him smiling.",
      microchipID: "AX90002GH78W9",
      intakeDate: new Date("2026-09-26"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: D,
      staffID: null,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
      featuredFlag: true,
    },
    // ── Remaining adoption statuses ──
    {
      petName: "Hazel",
      breedID: breed["Domestic Shorthair"],
      petDOB: dobFromAge(4, 2, new Date("2022-05-18")),
      petWeight: 4.1,
      petHeight: 24.0,
      petBGroup: "A",
      petColor: "Tortoiseshell",
      petSize: "Small",
      petPhoto: `${PET_IMAGES}/hazel.png`,
      petSex: "F",
      petDesc:
        "Hazel is a shy tortoiseshell recovering from dental surgery. She's in a foster home while she heals and learns to trust people again.",
      intakeDate: intakeDateMonthsAgo(2, 3),
      intakeType: "transferred", // came in from a partner rescue
      adoptionStatus: "fostered", // with Noah (Accepted Foster application below)
      shelterID: D,
      staffID: daniel.userID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: true,
    },
    {
      petName: "Pepper",
      breedID: breed["Beagle"],
      petDOB: dobFromAge(1, 6, new Date("2025-03-09")),
      petWeight: 9.0,
      petHeight: 35.0,
      petBGroup: "DEA1",
      petColor: "Lemon and White",
      petSize: "Medium",
      petPhoto: `${PET_IMAGES}/pepper.png`,
      petSex: "F",
      petDesc: "Pepper arrived this week and is still in intake — health check and temperament assessment pending.",
      intakeDate: daysFromNow(-3),
      intakeType: "stray",
      adoptionStatus: "incoming",
      shelterID: B,
      staffID: marcus.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Oscar",
      breedID: breed["Labrador"],
      petDOB: dobFromAge(13, 0, new Date("2013-04-02")),
      petWeight: 30.0,
      petHeight: 57.0,
      petBGroup: "DEA1",
      petColor: "Chocolate",
      petSize: "Large",
      petPhoto: `${PET_IMAGES}/oscar.png`,
      petSex: "M",
      petDesc: null,
      microchipID: "985141000000021",
      intakeDate: intakeDateMonthsAgo(20, 2),
      intakeType: "surrendered",
      adoptionStatus: "deceased",
      shelterID: D,
      staffID: sasha.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: true,
    },
  ];

  const pet = {};
  for (const data of pets) pet[data.petName] = (await prisma.pet.create({ data })).petID;

  // Photo gallery rows for the two photos uploaded through the app.
  await prisma.petPhoto.createMany({
    data: [
      { petID: pet.Cleo, photoURL: "pets/8/photo-1789752882891.png" },
      { petID: pet.Mischief, photoURL: "pets/771/photo-1790401452715.png" },
    ],
  });

  // ── TRANSFERS: every TransferStatus ──────────────────────────
  // Downtown's Transfers tab gets one incoming (Zeus, unassigned) and one
  // outgoing (Rocky, assigned to Brooklyn's manager) In_Progress transfer.
  // Completed moved Simba to Brooklyn; Rejected and Cancelled left Nimbus and
  // Polly available where they were.
  console.log("Creating transfers...");
  await prisma.transferHistory.createMany({
    data: [
      {
        petID: pet.Zeus,
        transferDate: daysFromNow(-2),
        fromShelterID: B,
        toShelterID: D,
        fromShelterStaff: marcus.userID,
        toShelterStaff: null,
        transferReason: "Requested transfer to Downtown — a Rottweiler-experienced foster family is interested there.",
        transferStatus: "In_Progress",
      },
      {
        petID: pet.Rocky,
        transferDate: daysFromNow(-1),
        fromShelterID: D,
        toShelterID: B,
        fromShelterStaff: sasha.userID,
        toShelterStaff: marcus.userID,
        transferReason: "Capacity transfer — Brooklyn has more space to accommodate his monthly vet visits.",
        transferStatus: "In_Progress",
      },
      {
        petID: pet.Simba,
        transferDate: daysFromNow(-60),
        fromShelterID: D,
        toShelterID: B,
        fromShelterStaff: sasha.userID,
        toShelterStaff: marcus.userID,
        transferReason: "Brooklyn's cat room had space and a waiting list of cat adopters.",
        transferStatus: "Completed",
      },
      {
        petID: pet.Nimbus,
        transferDate: daysFromNow(-25),
        fromShelterID: D,
        toShelterID: B,
        fromShelterStaff: daniel.userID,
        toShelterStaff: marcus.userID,
        transferReason: "Proposed move to Brooklyn's aviary.",
        transferStatus: "Rejected",
      },
      {
        petID: pet.Polly,
        transferDate: daysFromNow(-15),
        fromShelterID: D,
        toShelterID: shelter3.shelterID,
        fromShelterStaff: sasha.userID,
        toShelterStaff: null,
        transferReason: "Queens bird specialist visit — cancelled once Queens filled up.",
        transferStatus: "Cancelled",
      },
    ],
  });

  // ── APPOINTMENTS: every stored status + derived "Completed" ──
  // appointmentStatus is only ever written as Scheduled or Cancelled by the
  // app; a past Scheduled one displays as Completed. One row stores
  // Completed explicitly as well. Buddy (Emelie), Shadow and Hazel (Noah)
  // show on the adopters' own Appointments tab.
  console.log("Creating appointments...");
  const createAppointment = (data) => prisma.appointment.create({ data });
  const buddyCheckup = await createAppointment({
    petID: pet.Buddy,
    vetID: vet.userID,
    shelterID: D,
    staffID: sasha.userID,
    appointmentDate: nyAt(-40, 10),
    appointmentReason: "Pre-adoption health check and DHPP booster.",
    appointmentStatus: "Scheduled", // past → displays as Completed
  });
  await createAppointment({
    petID: pet.Buddy,
    vetID: vet.userID,
    shelterID: D,
    staffID: sasha.userID,
    volunteerID: bryan.userID,
    appointmentDate: nyAt(14, 10, 30),
    appointmentReason: "Six-month wellness exam.",
    appointmentStatus: "Scheduled",
  });
  await createAppointment({
    petID: pet.Buddy,
    vetID: vet.userID,
    shelterID: D,
    staffID: daniel.userID,
    appointmentDate: nyAt(3, 16),
    appointmentReason: "Ear check — cancelled, symptoms cleared up.",
    appointmentStatus: "Cancelled",
  });
  const rockyCheckup = await createAppointment({
    petID: pet.Rocky,
    vetID: vet.userID,
    shelterID: D,
    staffID: daniel.userID,
    appointmentDate: nyAt(-30, 9),
    appointmentReason: "Monthly cardiac check.",
    appointmentStatus: "Completed", // stored explicitly
  });
  await createAppointment({
    petID: pet.Rocky,
    vetID: vet.userID,
    shelterID: D,
    staffID: daniel.userID,
    volunteerID: maya.userID,
    appointmentDate: nyAt(7, 14),
    appointmentReason: "Monthly cardiac check.",
    appointmentStatus: "Scheduled",
  });
  await createAppointment({
    petID: pet.Shadow,
    vetID: amara.userID,
    shelterID: B,
    staffID: marcus.userID,
    volunteerID: zoe.userID,
    appointmentDate: nyAt(10, 11),
    appointmentReason: "Annual vaccinations.",
    appointmentStatus: "Scheduled",
  });
  const hazelCheckup = await createAppointment({
    petID: pet.Hazel,
    vetID: vet.userID,
    shelterID: D,
    staffID: null, // booked by an Admin
    appointmentDate: nyAt(-10, 15),
    appointmentReason: "Post-surgery follow-up and FVRCP.",
    appointmentStatus: "Scheduled",
  });

  // ── HEALTH RECORDS & VACCINATIONS ────────────────────────────
  // Rocky's Health Passport shows one vaccination per status (Overdue /
  // Due Soon / Up to Date, from dueDate). Doses given at an appointment link
  // to it (appointmentID) — that's what the appointment detail's "Vaccines
  // administered" lists. Buddy's rabies dose predates the shelter (no vet,
  // no shelter, no appointment).
  console.log("Creating health records and vaccinations...");
  await prisma.healthRecord.createMany({
    data: [
      { petID: pet.Rocky, vetID: vet.userID, createdAt: intakeDateMonthsAgo(6, 27), recordDesc: "Routine checkup. No issues found." },
      {
        petID: pet.Rocky,
        vetID: vet.userID,
        createdAt: intakeDateMonthsAgo(1, 1),
        recordDesc: "Weight loss observed. Slight breathing issues noted. Basilac (2 doses, 4 days) prescribed.",
      },
      { petID: pet.Buddy, vetID: vet.userID, createdAt: nyAt(-40, 10, 30), recordDesc: "Healthy. Cleared for adoption." },
      { petID: pet.Oscar, vetID: null, createdAt: daysFromNow(-20), recordDesc: "Passed away peacefully in his sleep. Recorded by shelter staff." },
    ],
  });

  await prisma.vaccinationRecord.createMany({
    data: [
      {
        petID: pet.Rocky,
        vaccineID: vaccine.Rabies,
        administeredDate: daysFromNow(-730),
        dueDate: daysFromNow(-45), // Overdue
        administeredBy: vet.userID,
        administeredAt: D,
      },
      {
        petID: pet.Rocky,
        vaccineID: vaccine.DHPP,
        administeredDate: daysFromNow(-320),
        dueDate: daysFromNow(20), // Due Soon
        administeredBy: vet.userID,
        administeredAt: D,
      },
      {
        petID: pet.Rocky,
        vaccineID: vaccine.Bordetella,
        administeredDate: rockyCheckup.appointmentDate,
        dueDate: daysFromNow(335), // Up to Date
        administeredBy: vet.userID,
        administeredAt: D,
        appointmentID: rockyCheckup.appointmentID,
      },
      {
        petID: pet.Buddy,
        vaccineID: vaccine.DHPP,
        administeredDate: buddyCheckup.appointmentDate,
        dueDate: daysFromNow(325),
        administeredBy: vet.userID,
        administeredAt: D,
        appointmentID: buddyCheckup.appointmentID,
      },
      {
        petID: pet.Buddy,
        vaccineID: vaccine.Rabies,
        administeredDate: daysFromNow(-400),
        dueDate: daysFromNow(330),
        administeredBy: null,
        administeredAt: null,
      },
      {
        petID: pet.Hazel,
        vaccineID: vaccine.FVRCP,
        administeredDate: hazelCheckup.appointmentDate,
        dueDate: daysFromNow(355),
        administeredBy: vet.userID,
        administeredAt: D,
        appointmentID: hazelCheckup.appointmentID,
      },
    ],
  });

  // ── ADOPTION APPLICATIONS: every ApplicationStatus + type ────
  // Apollo has two competing Pending applications — one unassigned, one
  // assigned to a staff member. Only one Pending/Accepted application per
  // adopter+pet is allowed (partial unique index).
  console.log("Creating adoption applications...");
  let session = 0;
  const stripe = (paid = true) => {
    session += 1;
    const n = String(session).padStart(4, "0");
    return { stripeCheckoutSessionID: `cs_test_seed_${n}`, stripePaymentIntentID: paid ? `pi_test_seed_${n}` : null };
  };
  await prisma.adoptionApplication.createMany({
    data: [
      {
        petID: pet.Buddy,
        adopterID: emelie.userID,
        shelterID: D,
        staffID: sasha.userID,
        createdAt: daysFromNow(-45),
        applicationStatus: "Accepted",
        shelterMessage: "Buddy would be my first dog — I work from home and live next to a big park.",
        staffRemark: "Great match. Home visit went well; congratulations!",
        ...stripe(),
      },
      {
        petID: pet.Apollo,
        adopterID: emelie.userID,
        shelterID: D,
        staffID: null, // not yet picked up by anyone
        createdAt: daysFromNow(-3),
        applicationStatus: "Pending",
        shelterMessage: null,
        ...stripe(),
      },
      {
        petID: pet.Nimbus,
        adopterID: emelie.userID,
        shelterID: D,
        staffID: daniel.userID,
        createdAt: daysFromNow(-30),
        applicationStatus: "Rejected",
        shelterMessage: "I'd love a calm companion bird.",
        staffRemark: "Nimbus needs an aviary-style setup that an apartment can't offer right now.",
        ...stripe(),
      },
      {
        petID: pet.Cleo,
        adopterID: emelie.userID,
        shelterID: D,
        staffID: daniel.userID,
        createdAt: daysFromNow(-20),
        applicationStatus: "Withdrawn",
        shelterMessage: "Cleo seems like a character!",
        ...stripe(false),
      },
      {
        petID: pet.Shadow,
        adopterID: noah.userID,
        shelterID: B,
        staffID: marcus.userID,
        createdAt: daysFromNow(-70),
        applicationStatus: "Accepted",
        shelterMessage: "Our kids have grown up with cats.",
        staffRemark: "Approved after a lovely meet-and-greet.",
        ...stripe(),
      },
      {
        petID: pet.Apollo,
        adopterID: noah.userID,
        shelterID: D,
        staffID: daniel.userID, // assigned
        createdAt: daysFromNow(-6),
        applicationStatus: "Pending",
        shelterMessage: "We have a fenced yard and experience with working breeds.",
        ...stripe(),
      },
      {
        petID: pet.Hazel,
        adopterID: noah.userID,
        shelterID: D,
        staffID: daniel.userID,
        createdAt: daysFromNow(-50),
        applicationStatus: "Accepted",
        applicationType: "Foster",
        shelterMessage: "Happy to foster while she recovers.",
        staffRemark: "Foster approved through her recovery.",
        ...stripe(),
      },
      {
        petID: pet.Teddy,
        adopterID: riley.userID,
        shelterID: B,
        staffID: marcus.userID,
        createdAt: daysFromNow(-35),
        applicationStatus: "Rejected",
        shelterMessage: null,
        staffRemark: "Declined — references could not be verified.",
        ...stripe(),
      },
    ],
  });

  // ── FAVORITES ────────────────────────────────────────────────
  // Includes a pet that's no longer available (Rocky, mid-transfer).
  await prisma.favorite.createMany({
    data: [
      { adopterID: emelie.userID, petID: pet.Apollo },
      { adopterID: emelie.userID, petID: pet.Teddy },
      { adopterID: emelie.userID, petID: pet.Mochi },
      { adopterID: emelie.userID, petID: pet.Rocky },
      { adopterID: noah.userID, petID: pet.Teddy },
      { adopterID: noah.userID, petID: pet.Mischief },
    ],
  });

  // ── VISITS: every VisitStatus, incl. unconfirmed (null) ──────
  // An unconfirmed visit has no staff yet. A visit can be to the shelter in
  // general (no pet). Riley's past unconfirmed-then-missed and cancelled
  // visits show the history side.
  console.log("Creating visits...");
  await prisma.visit.createMany({
    data: [
      { adopterID: emelie.userID, petID: pet.Apollo, shelterID: D, visitTime: nyAt(2, 11), visitStatus: null },
      { adopterID: emelie.userID, petID: pet.Biscuit, shelterID: D, staffID: daniel.userID, visitTime: nyAt(5, 15), visitStatus: "Confirmed" },
      {
        adopterID: emelie.userID,
        petID: pet.Buddy,
        shelterID: D,
        staffID: sasha.userID,
        visitTime: nyAt(-48, 10),
        visitStatus: "Completed",
        remarks: "Buddy and Emelie hit it off straight away.",
      },
      { adopterID: emelie.userID, petID: pet.Cleo, shelterID: D, visitTime: nyAt(8, 12), visitStatus: "Cancelled" },
      { adopterID: noah.userID, petID: null, shelterID: B, staffID: marcus.userID, visitTime: nyAt(3, 13), visitStatus: "Confirmed", remarks: "General tour for the family." },
      { adopterID: noah.userID, petID: pet.Shadow, shelterID: B, staffID: marcus.userID, visitTime: nyAt(-72, 16), visitStatus: "Completed" },
      { adopterID: riley.userID, petID: pet.Teddy, shelterID: B, visitTime: nyAt(-40, 10), visitStatus: null },
      { adopterID: riley.userID, petID: pet.Teddy, shelterID: B, visitTime: nyAt(-36, 10), visitStatus: "Cancelled" },
    ],
  });

  // ── GOVERNMENT IDS: every VerificationStatus, several roles ──
  // documentURL points at sample files already in the private
  // government-ids bucket (the paths are just storage keys, so they're
  // reused across users). Some accounts deliberately have none.
  console.log("Creating government IDs...");
  const ID_FILES = {
    passport: "adopter/4/id-1788705867254.png",
    license: "adopter/363/id-1788887945995.png",
    stateId: "adopter/259/id-1788707252142.pdf",
    other: "adopter/4/id-1788327272037.png",
  };
  const pendingStaff = await prisma.users.findUnique({ where: { userEmail: "staff.pending@petpals.com" } });
  const pendingVet = await prisma.users.findUnique({ where: { userEmail: "vet.pending@petpals.com" } });
  await prisma.governmentID.createMany({
    data: [
      { userID: emelie.userID, userType: "Adopter", idType: "Passport", idNumber: "CPJ1005010", verificationStatus: "Verified", documentURL: ID_FILES.passport },
      { userID: noah.userID, userType: "Adopter", idType: "Driver's License", idNumber: "D12345678", verificationStatus: "Pending", documentURL: ID_FILES.license },
      { userID: riley.userID, userType: "Adopter", idType: "State ID", idNumber: "S99887766", verificationStatus: "Rejected", documentURL: ID_FILES.stateId },
      { userID: sasha.userID, userType: "Staff", idType: "Driver's License", idNumber: "D55501234", verificationStatus: "Verified", documentURL: ID_FILES.other },
      { userID: pendingStaff.userID, userType: "Staff", idType: "Passport", idNumber: "P44412345", verificationStatus: "Pending", documentURL: ID_FILES.passport },
      { userID: pendingVet.userID, userType: "Veterinarian", idType: "Driver's License", idNumber: "D77712345", verificationStatus: "Pending", documentURL: ID_FILES.license },
      { userID: bryan.userID, userType: "Volunteer", idType: "State ID", idNumber: "S11122233", verificationStatus: "Verified", documentURL: ID_FILES.stateId },
      { userID: leo.userID, userType: "Volunteer", idType: "Passport", idNumber: "P88812345", verificationStatus: "Pending", documentURL: ID_FILES.passport },
      { userID: adminPendingUser.userID, userType: "Admin", idType: "Passport", idNumber: "P31415926", verificationStatus: "Pending", documentURL: ID_FILES.other },
    ],
  });

  // ── VOLUNTEER APPLICATIONS: every VolunteerAppStatus ─────────
  await prisma.volunteerApplication.createMany({
    data: [
      { volunteerID: bryan.userID, staffID: sasha.userID, shelterID: D, applicationStatus: "Accepted", createdAt: daysFromNow(-400) },
      { volunteerID: maya.userID, staffID: daniel.userID, shelterID: D, applicationStatus: "Accepted", createdAt: daysFromNow(-200) },
      { volunteerID: zoe.userID, staffID: marcus.userID, shelterID: B, applicationStatus: "Accepted", createdAt: daysFromNow(-150) },
      { volunteerID: leo.userID, staffID: null, shelterID: D, applicationStatus: "Created", createdAt: daysFromNow(-2) },
      {
        volunteerID: nina.userID,
        staffID: sasha.userID,
        shelterID: D,
        applicationStatus: "Rejected",
        applicationRemark: "Repeated no-shows during the trial period.",
        createdAt: daysFromNow(-90),
      },
    ],
  });

  // ── TASKS: every TaskName + TaskStatus, incl. overdue ────────
  // "Overdue" is derived (In_progress with taskDue in the past), never stored.
  // Assignees must be Active volunteers at the task's shelter.
  console.log("Creating tasks...");
  const tasks = [
    { taskName: "Feeding", taskDesc: "Morning feed for the kennel block.", taskDate: daysFromNow(-1), taskDue: daysFromNow(1), taskStatus: "In_progress", shelterID: D, staffID: sasha.userID, volunteers: [bryan, maya] },
    { taskName: "Cleaning", taskDesc: "Deep-clean the cat room.", taskDate: daysFromNow(-6), taskDue: daysFromNow(-2), taskStatus: "In_progress", shelterID: D, staffID: daniel.userID, volunteers: [bryan] },
    { taskName: "Animal_Care", taskDesc: "Brush and bathe the long-haired cats.", taskDate: daysFromNow(-9), taskDue: daysFromNow(-5), taskStatus: "Completed", shelterID: D, staffID: daniel.userID, volunteers: [maya] },
    { taskName: "Vet_Assistance", taskDesc: "Help hold Rocky during his cardiac check.", taskDate: daysFromNow(-4), taskDue: daysFromNow(3), taskStatus: "Cancelled", shelterID: D, staffID: sasha.userID, volunteers: [bryan] },
    { taskName: "Events", taskDesc: "Set up pens and signage for the Monthly Meet & Greet.", taskDate: daysFromNow(-2), taskDue: daysFromNow(6), taskStatus: "In_progress", shelterID: D, staffID: sasha.userID, volunteers: [bryan, maya] },
    { taskName: "Admin", taskDesc: "Update adoption paperwork binders.", taskDate: daysFromNow(-1), taskDue: daysFromNow(10), taskStatus: "In_progress", shelterID: D, staffID: null, volunteers: [maya] },
    { taskName: "Other", taskDesc: "Walk the Brooklyn dogs along the promenade.", taskDate: daysFromNow(-8), taskDue: daysFromNow(-6), taskStatus: "Completed", shelterID: B, staffID: marcus.userID, volunteers: [zoe] },
  ];
  for (const { volunteers, ...data } of tasks) {
    await prisma.task.create({
      data: { ...data, volunteers: { create: volunteers.map((v) => ({ volunteerID: v.userID })) } },
    });
  }

  // ── EVENTS: one per EventCategory ────────────────────────────
  // Mostly upcoming, one past. Brooklyn's are run by its manager except the
  // Open House (created by an Admin, so no staffID).
  console.log("Creating events...");
  const events = [
    { shelterID: D, staffID: sasha.userID, eventCategory: "Adoption_Event", eventName: "Monthly Meet & Greet", eventDate: nyAt(6, 11), eventDesc: "Meet our adoptable dogs, cats and rabbits in person. Adoption counsellors will be on hand to answer questions and help you find your match.", volunteers: [bryan] },
    { shelterID: B, staffID: marcus.userID, eventCategory: "Fundraiser", eventName: "Paws in the Park Charity Walk", eventDate: nyAt(20, 9), eventDesc: "A 5K walk through Brooklyn Bridge Park — bring your dog or walk one of ours. Every registration funds a week of food and care for a shelter pet.", volunteers: [zoe] },
    { shelterID: D, staffID: sasha.userID, eventCategory: "Volunteer_Orientation", eventName: "New Volunteer Orientation", eventDate: nyAt(9, 18), eventDesc: "Start here if you've just signed up to volunteer. We'll cover shelter safety, animal handling basics and how to pick up your first shifts.", volunteers: [maya] },
    { shelterID: B, staffID: marcus.userID, eventCategory: "Vaccination_Clinic", eventName: "Low-Cost Vaccine & Microchip Clinic", eventDate: nyAt(13, 10), eventDesc: "Rabies, DHPP and FVRCP vaccines plus microchipping at reduced prices for community pets. Walk-ins welcome while supplies last.", volunteers: [] },
    { shelterID: D, staffID: daniel.userID, eventCategory: "Community_Outreach", eventName: "Pets at the Library Storytime", eventDate: nyAt(16, 15, 30), eventDesc: "Kids read aloud to our calmest shelter dogs at the local library while our team talks about responsible pet ownership.", volunteers: [bryan, maya] },
    { shelterID: B, staffID: marcus.userID, eventCategory: "Workshop", eventName: "Puppy Training 101 Workshop", eventDate: nyAt(27, 14), eventDesc: "A hands-on class covering house training, leash manners and basic commands. Recommended for new and soon-to-be puppy owners.", volunteers: [] },
    { shelterID: D, staffID: sasha.userID, eventCategory: "Donation_Drive", eventName: "Winter Blanket & Food Drive", eventDate: nyAt(34, 10), eventDesc: "Drop off blankets, towels, unopened pet food and toys to keep our animals warm this winter. Donation receipts available at the desk.", volunteers: [] },
    { shelterID: B, staffID: null, eventCategory: "Other", eventName: "Shelter Open House", eventDate: nyAt(-10, 12), eventDesc: "Tour the shelter, meet the team and see where the animals live. Refreshments provided.", volunteers: [zoe] },
  ];
  for (const { volunteers, ...data } of events) {
    await prisma.event.create({
      data: { ...data, volunteers: { create: volunteers.map((v) => ({ volunteerID: v.userID })) } },
    });
  }

  // ── DONATIONS ────────────────────────────────────────────────
  // Spread over the past year across three shelters, several in the last
  // couple of weeks (Donations tab "This Month"), some without a message,
  // and past gifts from donors whose accounts are now Banned/Deactivated.
  console.log("Creating donations...");
  await prisma.donation.createMany({
    data: [
      { donorID: charlotte.userID, shelterID: D, donationDate: daysFromNow(-3), donationAmt: 500, donationDesc: "On the special occasion of my birthday, for the animals at PetPals Downtown." },
      { donorID: jane.userID, shelterID: D, donationDate: daysFromNow(-12), donationAmt: 120, donationDesc: "Monthly gift for food and litter." },
      { donorID: tammy.userID, shelterID: D, donationDate: daysFromNow(-45), donationAmt: 250, donationDesc: null },
      { donorID: jane.userID, shelterID: D, donationDate: daysFromNow(-75), donationAmt: 240, donationDesc: "In memory of Biscuit, adopted from you in 2019." },
      { donorID: charlotte.userID, shelterID: D, donationDate: daysFromNow(-200), donationAmt: 1000, donationDesc: "Towards the new cat enclosure." },
      { donorID: tammy.userID, shelterID: B, donationDate: daysFromNow(-8), donationAmt: 75, donationDesc: null },
      { donorID: charlotte.userID, shelterID: B, donationDate: daysFromNow(-150), donationAmt: 300, donationDesc: "For vaccines and vet care." },
      { donorID: victor.userID, shelterID: D, donationDate: daysFromNow(-100), donationAmt: 50, donationDesc: null },
      { donorID: rosa.userID, shelterID: shelter3.shelterID, donationDate: daysFromNow(-320), donationAmt: 150, donationDesc: "For the Queens bird room." },
    ],
  });

  // ── NOTIFICATIONS: every type / status / recipient type ──────
  // Not yet sent or read by any app code — seeded so the table isn't empty.
  await prisma.notification.createMany({
    data: [
      { recipientID: emelie.userID, recipientType: "adopter", notificationType: "vaccination", notificationStatus: "Sent", sendTime: daysFromNow(-2), textBody: "Buddy's Rabies vaccination is due within the year — book a visit with PetPals Downtown." },
      { recipientID: vet.userID, recipientType: "veterinarian", notificationType: "appointment", notificationStatus: "Pending", sendTime: daysFromNow(6), textBody: "Reminder: Rocky's monthly cardiac check is tomorrow." },
      { recipientID: bryan.userID, recipientType: "volunteer", notificationType: "task", notificationStatus: "Failed", sendTime: daysFromNow(-1), textBody: "New task assigned: Morning feed for the kennel block." },
      { recipientID: sasha.userID, recipientType: "staff", notificationType: "task", notificationStatus: "Sent", sendTime: daysFromNow(-2), textBody: "Task overdue: Deep-clean the cat room." },
    ],
  });

  console.log("✅ Seeding complete!");
  console.log("");
  console.log("Logins (role — email / password — case):");
  for (const { role, email, password, note } of logins) {
    console.log(`  ${role.padEnd(12)} ${email.padEnd(36)} ${password.padEnd(14)} ${note}`);
  }
  console.log("");
  console.log("Pet photos not yet in the pet-images bucket: hazel.png, pepper.png, oscar.png");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
