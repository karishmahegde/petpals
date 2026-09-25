// PetPals — Seed Script
// Run with: npx prisma db seed
// Creates: 2 shelters, species, breeds, 17 pets, 1 test user per role

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL;
if (!SUPABASE_PROJECT_URL) {
  throw new Error("SUPABASE_URL must be set in .env to seed pet photo URLs");
}
// Public base URL for the pet-images bucket — pet photos are served directly from here.
const SUPABASE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/pet-images`;

// Computes a DOB so the pet is (approximately) `years` years and `months`
// months old as of TODAY — not as of intakeDate. Age is now always derived
// live from petDOB, so it stays accurate going forward instead of being
// frozen at whatever it was when the row was first seeded.
// `refDate` (typically the original intakeDate) only supplies the day-of-month
// for variety/realism — the actual month offset always comes from `months`,
// counted back from today's month.
// Both helpers build dates with Date.UTC, not `new Date(y, m, d)` (local
// midnight) — a local-time construction stores as local-midnight-in-UTC,
// which crosses into the previous UTC day whenever the machine's timezone is
// ahead of UTC (e.g. UTC+5:30 shifts every date back by ~5.5 hours), and
// since it's read back with local-timezone getters too, the resulting
// month/year bucket depends on whatever timezone the *reading* process
// happens to run in. UTC construction + UTC reads (see getMonthlyStats) keep
// this deterministic across machines/environments.
function dobFromAge(years, months, refDate) {
  const today = new Date();
  const day = refDate ? refDate.getUTCDate() : today.getUTCDate();
  return new Date(
    Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth() - months, day),
  );
}

// Same rationale as dobFromAge above: intakeDate relative to TODAY, not a
// frozen calendar date, so a re-seed always lands some pets inside the Admin
// Overview "Stats" chart's trailing-months window instead of aging out of it.
// `day` (from the original reference date) is kept for variety only.
function intakeDateMonthsAgo(monthsAgo, day) {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, day));
}

async function main() {
  console.log("🌱 Seeding PetPals database...");

  // ── ADMIN ────────────────────────────────────────────────────
  console.log("Creating admin...");
  const adminUser = await prisma.users.upsert({
    where: { userEmail: "admin@petpals.com" },
    update: {},
    create: {
      userEmail: "admin@petpals.com",
      userPassword: await bcrypt.hash("Admin@123", 10),
      role: "Admin",
    },
  });
  const admin = await prisma.admin.upsert({
    where: { userID: adminUser.userID },
    update: {},
    create: {
      userID: adminUser.userID,
      adminName: "Isabella Martinez",
      avatarSeed: crypto.randomUUID(),
      adminPhone: "+12125550102",
      adminAddress: "456 Elm Street, New York, NY 10001",
      adminDOB: new Date("1985-11-02"),
      adminSex: "F",
      accountStatus: "Active",
    },
  });

  // ── SHELTERS ─────────────────────────────────────────────────
  console.log("Creating shelters...");
  const shelter1 = await prisma.shelter.upsert({
    where: { shelterID: 1 },
    update: {},
    create: {
      shelterName: "PetPals Downtown",
      shelterAddress: "123 Main Street, New York, NY 10001",
      shelterPhone: "+12125550101",
      shelterEmail: "downtown@petpals.com",
      shelterZIP: 10001,
      shelterSize: 50,
      shelterStatus: "Open",
    },
  });

  await prisma.$executeRaw`
    UPDATE "Shelter"
    SET "shelterLocation" = ST_SetSRID(ST_MakePoint(-73.9965, 40.7505), 4326)
    WHERE "shelterID" = ${shelter1.shelterID}
  `;

  const shelter2 = await prisma.shelter.upsert({
    where: { shelterID: 2 },
    update: {},
    create: {
      shelterName: "PetPals Brooklyn",
      shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
      shelterPhone: "+17185550202",
      shelterEmail: "brooklyn@petpals.com",
      shelterZIP: 11201,
      shelterSize: 40,
      shelterStatus: "Open",
    },
  });

  await prisma.$executeRaw`
    UPDATE "Shelter"
    SET "shelterLocation" = ST_SetSRID(ST_MakePoint(-73.9903, 40.6943), 4326)
    WHERE "shelterID" = ${shelter2.shelterID}
  `;

  // ── STAFF ────────────────────────────────────────────────────
  console.log("Creating staff...");
  const staffUser = await prisma.users.upsert({
    where: { userEmail: "staff@petpals.com" },
    update: {},
    create: {
      userEmail: "staff@petpals.com",
      userPassword: await bcrypt.hash("Staff@123", 10),
      role: "Staff",
    },
  });
  const staff = await prisma.staff.upsert({
    where: { userID: staffUser.userID },
    update: {},
    create: {
      userID: staffUser.userID,
      staffName: "Sasha Grey",
      avatarSeed: crypto.randomUUID(),
      staffPhone: "+12125550103",
      shelterID: shelter1.shelterID,
      staffDOB: new Date("1988-03-15"),
      staffSex: "F",
      staffDOJ: new Date("2020-01-10"),
      staffDesignation: "Senior",
      accountStatus: "Active",
    },
  });

  // Update shelter1 manager
  await prisma.shelter.update({
    where: { shelterID: shelter1.shelterID },
    data: { managerStaffID: staff.userID },
  });

  // ── VETERINARIAN ─────────────────────────────────────────────
  console.log("Creating vet...");
  const vetUser = await prisma.users.upsert({
    where: { userEmail: "vet@petpals.com" },
    update: {},
    create: {
      userEmail: "vet@petpals.com",
      userPassword: await bcrypt.hash("Vet@123", 10),
      role: "Veterinarian",
    },
  });
  const vet = await prisma.veterinarian.upsert({
    where: { userID: vetUser.userID },
    update: {},
    create: {
      userID: vetUser.userID,
      vetName: "Jay Asarathi",
      avatarSeed: crypto.randomUUID(),
      vetPhone: "+12125550104",
      vetAddress: "789 Oak Lane, New York, NY 10002",
      vetDOB: new Date("1980-07-22"),
      vetSex: "M",
      shelterID: shelter1.shelterID,
      accountStatus: "Active",
    },
  });

  // ── ADOPTER ──────────────────────────────────────────────────
  console.log("Creating adopter...");
  const adopterUser = await prisma.users.upsert({
    where: { userEmail: "adopter@petpals.com" },
    update: {},
    create: {
      userEmail: "adopter@petpals.com",
      userPassword: await bcrypt.hash("Adopter@123", 10),
      role: "Adopter",
    },
  });
  await prisma.adopter.upsert({
    where: { userID: adopterUser.userID },
    update: {},
    create: {
      userID: adopterUser.userID,
      adopterName: "Emelie Archer",
      avatarSeed: crypto.randomUUID(),
      adopterPhone: "+12125550105",
      adopterDOB: new Date("1998-11-05"),
      adopterSex: "F",
      housingType: "Apartment",
      ownsOrRents: "Rents",
      householdSize: 1,
      numChildren: 0,
      employmentStatus: "Employed",
      activityLevel: "Active",
      yardAvailable: false,
      petExperience: "Some",
      currentPets: 0,
      openToSpecialNeeds: false,
      emailVerified: true,
      accountStatus: "Active",
    },
  });

  // ── VOLUNTEER ────────────────────────────────────────────────
  console.log("Creating volunteer...");
  const volunteerUser = await prisma.users.upsert({
    where: { userEmail: "volunteer@petpals.com" },
    update: {},
    create: {
      userEmail: "volunteer@petpals.com",
      userPassword: await bcrypt.hash("Volunteer@123", 10),
      role: "Volunteer",
    },
  });

  const volunteerApp = await prisma.volunteerApplication.create({
    data: {
      shelterID: shelter1.shelterID,
      applicationStatus: "Accepted",
    },
  });

  const volunteer = await prisma.volunteer.upsert({
    where: { userID: volunteerUser.userID },
    update: {},
    create: {
      userID: volunteerUser.userID,
      volunteerName: "Bryan Smith",
      avatarSeed: crypto.randomUUID(),
      volunteerPhone: "+12125550106",
      volunteerAddress: "321 Elm Street, Chicago, IL 60601",
      volunteerDOB: new Date("2005-09-18"),
      volunteerSex: "M",
      volunteerSchedule: "Weekends 9am-5pm",
      shelterID: shelter1.shelterID,
      accountStatus: "Active",
    },
  });

  await prisma.volunteerApplication.update({
    where: { applicationID: volunteerApp.applicationID },
    data: { volunteerID: volunteer.userID },
  });

  // ── DONOR ────────────────────────────────────────────────────
  console.log("Creating donor...");
  const donorUser = await prisma.users.upsert({
    where: { userEmail: "donor@petpals.com" },
    update: {},
    create: {
      userEmail: "donor@petpals.com",
      userPassword: await bcrypt.hash("Donor@123", 10),
      role: "Donor",
    },
  });
  await prisma.donor.upsert({
    where: { userID: donorUser.userID },
    update: {},
    create: {
      userID: donorUser.userID,
      donorName: "Charlotte Salazar",
      avatarSeed: crypto.randomUUID(),
      donorPhone: "+12125550107",
      donorAddress: "654 Pine Road, California, CA 90001",
      donorDOB: new Date("1958-04-30"),
      donorSex: "F",
      accountStatus: "Active",
    },
  });

  // ── SPECIES ──────────────────────────────────────────────────
  console.log("Creating species and breeds...");
  const dog = await prisma.species.upsert({
    where: { speciesID: 1 },
    update: {},
    create: { speciesName: "Dog" },
  });

  const cat = await prisma.species.upsert({
    where: { speciesID: 2 },
    update: {},
    create: { speciesName: "Cat" },
  });

  const bird = await prisma.species.upsert({
    where: { speciesID: 3 },
    update: {},
    create: { speciesName: "Bird" },
  });

  const rabbit = await prisma.species.upsert({
    where: { speciesID: 4 },
    update: {},
    create: { speciesName: "Rabbit" },
  });

  // ── BREEDS ───────────────────────────────────────────────────
  const germanShepherd = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "German Shepherd" },
  });
  const goldenRetriever = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "Golden Retriever" },
  });
  const beagle = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "Beagle" },
  });
  const labrador = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "Labrador" },
  });
  const bulldog = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "Bulldog" },
  });
  const rottweiler = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "Rottweiler" },
  });
  const toyPoodle = await prisma.breed.create({
    data: { speciesID: dog.speciesID, breedName: "Toy Poodle" },
  });
  const siamese = await prisma.breed.create({
    data: { speciesID: cat.speciesID, breedName: "Siamese" },
  });
  const domShorthair = await prisma.breed.create({
    data: { speciesID: cat.speciesID, breedName: "Domestic Shorthair" },
  });
  const britShorthair = await prisma.breed.create({
    data: { speciesID: cat.speciesID, breedName: "British Shorthair" },
  });
  const persian = await prisma.breed.create({
    data: { speciesID: cat.speciesID, breedName: "Persian" },
  });
  const maineCoon = await prisma.breed.create({
    data: { speciesID: cat.speciesID, breedName: "Maine Coon" },
  });
  const parrot = await prisma.breed.create({
    data: { speciesID: bird.speciesID, breedName: "Parrot" },
  });
  const blueMacaw = await prisma.breed.create({
    data: { speciesID: bird.speciesID, breedName: "Blue Macaw" },
  });
  const pigeon = await prisma.breed.create({
    data: { speciesID: bird.speciesID, breedName: "Pigeon" },
  });
  const hollowLop = await prisma.breed.create({
    data: { speciesID: rabbit.speciesID, breedName: "Holland Lop" },
  });

  // ── VACCINES ─────────────────────────────────────────────────
  console.log("Creating vaccines...");
  const dhpp = await prisma.vaccine.upsert({
    where: { vaccineID: 1 },
    update: {},
    create: { vaccineName: "DHPP", manufacturer: "Zoetis" },
  });
  const rabiesVaccine = await prisma.vaccine.upsert({
    where: { vaccineID: 2 },
    update: {},
    create: { vaccineName: "Rabies", manufacturer: "Boehringer" },
  });
  const bordetella = await prisma.vaccine.upsert({
    where: { vaccineID: 3 },
    update: {},
    create: { vaccineName: "Bordetella", manufacturer: "Merck" },
  });

  // ── PETS ─────────────────────────────────────────────────────
  console.log("Creating pets...");
  const pets = [
    {
      petName: "Apollo",
      breedID: germanShepherd.breedID,
      petDOB: dobFromAge(4, 0, new Date("2024-03-10")),
      petWeight: 32.0,
      petHeight: 62.0,
      petBGroup: "DEA4",
      petColor: "Black and Tan",
      petSize: "Large",
      petPhoto: `${SUPABASE_URL}/1.png`,
      petSex: "M",
      petDesc:
        "Apollo is a confident and loyal German Shepherd who takes his role as protector seriously. He thrives with experienced owners who can match his intelligence and energy. Best suited as the only pet in the home.",
      intakeDate: intakeDateMonthsAgo(11, 10), // Apollo
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Buddy",
      breedID: goldenRetriever.breedID,
      petDOB: dobFromAge(2, 0, new Date("2024-06-01")),
      petWeight: 28.5,
      petHeight: 58.0,
      petBGroup: "DEA1",
      petColor: "Golden",
      petSize: "Large",
      petPhoto: `${SUPABASE_URL}/2.png`,
      petSex: "M",
      petDesc:
        "Buddy is the definition of a family dog — endlessly cheerful, gentle with kids, and a best friend to every dog he meets. He loves fetch, swimming, and curling up on the couch after a long walk.",
      intakeDate: intakeDateMonthsAgo(8, 1), // Buddy
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Biscuit",
      breedID: beagle.breedID,
      petDOB: dobFromAge(6, 0, new Date("2024-01-20")),
      petWeight: 10.5,
      petHeight: 38.0,
      petBGroup: "DEA3",
      petColor: "Tricolor",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/3.png`,
      petSex: "M",
      petDesc:
        "Biscuit is a nose-to-the-ground explorer who never meets a smell he doesn't investigate. Calm and affectionate at home, he loves children and is happiest on long morning walks.",
      intakeDate: intakeDateMonthsAgo(14, 20), // Biscuit
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Daisy",
      breedID: labrador.breedID,
      petDOB: dobFromAge(1, 0, new Date("2024-08-15")),
      petWeight: 22.0,
      petHeight: 55.0,
      petBGroup: "DEA1",
      petColor: "Yellow",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/4.png`,
      petSex: "F",
      petDesc:
        "Daisy is a bouncy young Lab who is still learning the ropes. She is eager to please and picks up new commands quickly. She adores children and other dogs — the more the merrier.",
      intakeDate: intakeDateMonthsAgo(6, 15), // Daisy
      intakeType: "stray",
      adoptionStatus: "pending",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Rocky",
      breedID: bulldog.breedID,
      petDOB: dobFromAge(8, 0, new Date("2023-11-05")),
      petWeight: 24.0,
      petHeight: 40.0,
      petBGroup: "DEA4",
      petColor: "Brindle",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/5.png`,
      petSex: "M",
      petDesc:
        "Rocky is a laid-back senior Bulldog who asks for little more than a comfy sofa and a patient owner. He has a mild heart condition that requires monthly vet visits but is otherwise healthy and full of personality.",
      intakeDate: intakeDateMonthsAgo(15, 5), // Rocky
      intakeType: "surrendered",
      // "transferred" rather than "available" — an In_Progress TransferHistory
      // row is seeded for Rocky below (Downtown -> Brooklyn), same invariant
      // note as Zeus above.
      adoptionStatus: "transferred",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: true,
    },
    {
      petName: "Zeus",
      breedID: rottweiler.breedID,
      petDOB: dobFromAge(3, 0, new Date("2024-04-22")),
      petWeight: 45.0,
      petHeight: 65.0,
      petBGroup: "DEA3",
      petColor: "Black and Mahogany",
      petSize: "Large",
      petPhoto: `${SUPABASE_URL}/6.png`,
      petSex: "M",
      petDesc:
        "Zeus is a powerful and disciplined Rottweiler who is deeply loyal to those he trusts. He requires an experienced handler and a home without other animals. With the right owner, he is an incredibly devoted companion.",
      intakeDate: intakeDateMonthsAgo(10, 22), // Zeus
      intakeType: "surrendered",
      // "transferred" rather than "available" — an In_Progress TransferHistory
      // row is seeded for Zeus below (Brooklyn -> Downtown), and that's the
      // invariant a real transfer holds the pet at until it resolves.
      adoptionStatus: "transferred",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Teddy",
      breedID: toyPoodle.breedID,
      petDOB: dobFromAge(0, 4, null), // matches "4-month-old" in description
      petWeight: 1.2,
      petHeight: 18.0,
      petBGroup: "DEA1",
      petColor: "Apricot",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/7.png`,
      petSex: "M",
      petDesc:
        "Teddy is a fluffy 4-month-old Toy Poodle puppy who is curious about everything and afraid of nothing. He is still learning basic commands and would thrive with a patient first-time owner. Gets along wonderfully with kids and other pets.",
      intakeDate: intakeDateMonthsAgo(1, 1), // Teddy
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Cleo",
      breedID: siamese.breedID,
      petDOB: dobFromAge(3, 0, new Date("2024-05-10")),
      petWeight: 4.2,
      petHeight: 28.0,
      petBGroup: "AB",
      petColor: "Seal Point",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/8.png`,
      petSex: "F",
      petDesc:
        "Cleo is a vocal and opinionated Siamese who knows exactly what she wants. She forms deep bonds with her person but prefers to be the only animal in the home. Perfect for someone who wants a cat with real personality.",
      intakeDate: intakeDateMonthsAgo(9, 10), // Cleo
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: false,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Mittens",
      breedID: domShorthair.breedID,
      petDOB: dobFromAge(5, 0, new Date("2023-09-14")),
      petWeight: 4.8,
      petHeight: 25.0,
      petBGroup: "A",
      petColor: "White and Grey",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/9.png`,
      petSex: "F",
      petDesc:
        "Mittens is a gentle and easygoing cat who gets along with everyone — children, dogs, other cats. She loves sunny windowsills and will happily sit on a lap for hours. A wonderful first cat for any household.",
      intakeDate: intakeDateMonthsAgo(17, 14), // Mittens
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Shadow",
      breedID: britShorthair.breedID,
      petDOB: dobFromAge(7, 0, new Date("2023-06-01")),
      petWeight: 5.5,
      petHeight: 30.0,
      petBGroup: "B",
      petColor: "Blue Grey",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/10.png`,
      petSex: "M",
      petDesc:
        "Shadow found his forever home and is now thriving with his new family. A calm and dignified British Shorthair who won everyone over with his quiet affection.",
      intakeDate: intakeDateMonthsAgo(18, 1), // Shadow
      intakeType: "surrendered",
      adoptionStatus: "adopted",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Mochi",
      breedID: persian.breedID,
      petDOB: dobFromAge(0, 3, null), // matches "3-month-old" in description
      petWeight: 0.8,
      petHeight: 15.0,
      petBGroup: "A",
      petColor: "Cream",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/11.png`,
      petSex: "F",
      petDesc:
        "Mochi is a 3-month-old Persian kitten with a cloud-like coat and the most expressive eyes. She is playful and sociable, already comfortable around children and other pets. She will need regular grooming.",
      intakeDate: intakeDateMonthsAgo(0, 15), // Mochi
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Simba",
      breedID: maineCoon.breedID,
      petDOB: dobFromAge(1, 0, new Date("2024-10-08")),
      petWeight: 5.0,
      petHeight: 32.0,
      petBGroup: "AB",
      petColor: "Brown Tabby",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/12.png`,
      petSex: "M",
      petDesc:
        "Simba is a playful young Maine Coon who thinks he is much bigger than he is. He is endlessly curious, loves to climb, and chirps at birds through the window. Great with kids and other cats.",
      intakeDate: intakeDateMonthsAgo(4, 8), // Simba
      intakeType: "stray",
      adoptionStatus: "pending",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Polly",
      breedID: parrot.breedID,
      petDOB: dobFromAge(10, 0, new Date("2024-02-14")),
      petWeight: 0.5,
      petHeight: 30.0,
      petBGroup: "N/A",
      petPhoto: `${SUPABASE_URL}/13.png`,
      petColor: "Green and Red",
      petSize: "Small",
      petSex: "F",
      petDesc:
        "Polly is a remarkably intelligent 10-year-old parrot with a vocabulary of over 50 words. She needs mental stimulation, daily interaction, and a quiet home environment. Not suitable for homes with young children.",
      intakeDate: intakeDateMonthsAgo(12, 14), // Polly
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Bloo",
      breedID: blueMacaw.breedID,
      petDOB: dobFromAge(6, 0, new Date("2024-07-30")),
      petWeight: 1.2,
      petHeight: 75.0,
      petBGroup: "N/A",
      petColor: "Blue",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/14.png`,
      petSex: "M",
      petDesc:
        "Bloo is a stunning Blue Macaw with a bold personality to match his striking plumage. He is social and vocal, and bonds deeply with his owner. Requires an experienced bird owner and a large enclosure.",
      intakeDate: intakeDateMonthsAgo(7, 30), // Bloo
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Nimbus",
      breedID: pigeon.breedID,
      petDOB: dobFromAge(2, 0, new Date("2024-09-05")),
      petWeight: 0.4,
      petHeight: 32.0,
      petBGroup: "N/A",
      petColor: "Grey and White",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/15.png`,
      petSex: "M",
      petDesc:
        "Nimbus is a rescue pigeon who was found injured and nursed back to health. He is calm, gentle and surprisingly affectionate. He gets along well with other birds and is a wonderful low-maintenance companion.",
      intakeDate: intakeDateMonthsAgo(5, 5), // Nimbus
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Sky",
      breedID: pigeon.breedID,
      petDOB: dobFromAge(1, 0, new Date("2025-01-20")),
      petWeight: 0.35,
      petHeight: 30.0,
      petBGroup: "N/A",
      petColor: "White",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/16.png`,
      petSex: "F",
      petDesc:
        "Sky is a young white pigeon with a calm and trusting nature. She was rescued from a city rooftop and has since become very comfortable around people. A peaceful and easy companion for the right home.",
      intakeDate: intakeDateMonthsAgo(2, 20), // Sky
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Pebbles",
      breedID: hollowLop.breedID,
      petDOB: dobFromAge(2, 0, new Date("2024-11-12")),
      petWeight: 1.8,
      petHeight: 20.0,
      petBGroup: "N/A",
      petColor: "Grey and White",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/17.png`,
      petSex: "F",
      petDesc:
        "Pebbles is a sweet Holland Lop rabbit who loves to binky around the room and then flop dramatically by your feet. She is litter trained, gentle with children, and gets along well with other small animals.",
      intakeDate: intakeDateMonthsAgo(3, 12), // Pebbles
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.userID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
  ];

  // Keyed by petName so the Transfers seed below can reference the specific
  // pets it needs by their freshly-created petID (create() doesn't expose
  // that until the row exists).
  const createdPets = {};
  for (const pet of pets) {
    createdPets[pet.petName] = await prisma.pet.create({ data: pet });
  }

  // ── TRANSFERS ────────────────────────────────────────────────
  // Populates both Transfers-tab sections for staff@petpals.com (shelter1 —
  // PetPals Downtown): one incoming (Pending Transfers) and one outgoing
  // (Ongoing Transfers), both In_Progress. See the adoptionStatus notes on
  // Zeus/Rocky above — both pets are held at "transferred" while these are open.
  console.log("Creating transfers...");
  await prisma.transferHistory.create({
    data: {
      petID: createdPets["Zeus"].petID,
      transferDate: new Date(),
      fromShelterID: shelter2.shelterID,
      toShelterID: shelter1.shelterID,
      fromShelterStaff: null, // no staff seeded at shelter2 to attribute it to
      transferReason:
        "Requested transfer to Downtown — a Rottweiler-experienced foster family is interested there.",
      transferStatus: "In_Progress",
    },
  });
  await prisma.transferHistory.create({
    data: {
      petID: createdPets["Rocky"].petID,
      transferDate: new Date(),
      fromShelterID: shelter1.shelterID,
      toShelterID: shelter2.shelterID,
      fromShelterStaff: staff.userID,
      transferReason:
        "Capacity transfer — Brooklyn has more space to accommodate his monthly vet visits.",
      transferStatus: "In_Progress",
    },
  });

  // ── HEALTH RECORDS & VACCINATIONS ───────────────────────────
  // Populates the Health Passport page for Rocky (already has the outgoing
  // transfer above, and his own petDesc already mentions a heart condition
  // requiring monthly vet visits — a natural fit), attributed to the seeded
  // vet at shelter1. One vaccination per status (Overdue/Due Soon/Up to
  // Date — see staff/pets.service.js's vaccinationStatus, computed from
  // dueDate) for a full demo of the status badges.
  console.log("Creating health records and vaccinations...");
  const rockyID = createdPets["Rocky"].petID;
  // Precise day-offset dates for the vaccination demo below — dobFromAge/
  // intakeDateMonthsAgo are month-granularity (built for pet age/intake, not
  // this), which risks landing on the wrong side of the 30-day Due Soon
  // window depending on how long the current month is.
  const daysFromNow = (days) => new Date(Date.now() + days * 86400000);
  await prisma.healthRecord.create({
    data: {
      petID: rockyID,
      vetID: vet.userID,
      createdAt: intakeDateMonthsAgo(6, 27),
      recordDesc: "Routine checkup. No issues found.",
    },
  });
  await prisma.healthRecord.create({
    data: {
      petID: rockyID,
      vetID: vet.userID,
      createdAt: intakeDateMonthsAgo(1, 1),
      recordDesc:
        "Weight loss observed. Slight breathing issues noted. Basilac (2 doses, 4 days) prescribed.",
    },
  });

  await prisma.vaccinationRecord.create({
    data: {
      petID: rockyID,
      vaccineID: rabiesVaccine.vaccineID,
      administeredDate: daysFromNow(-730), // ~2 years ago
      dueDate: daysFromNow(-45), // 45 days ago — Overdue
      administeredBy: vet.userID,
      administeredAt: shelter1.shelterID,
    },
  });
  await prisma.vaccinationRecord.create({
    data: {
      petID: rockyID,
      vaccineID: dhpp.vaccineID,
      administeredDate: daysFromNow(-320), // ~10.5 months ago
      dueDate: daysFromNow(20), // 20 days from now — Due Soon
      administeredBy: vet.userID,
      administeredAt: shelter1.shelterID,
    },
  });
  await prisma.vaccinationRecord.create({
    data: {
      petID: rockyID,
      vaccineID: bordetella.vaccineID,
      administeredDate: daysFromNow(-30), // ~1 month ago
      dueDate: daysFromNow(330), // ~11 months from now — Up to Date
      administeredBy: vet.userID,
      administeredAt: shelter1.shelterID,
    },
  });

  // ── EVENTS ───────────────────────────────────────────────────
  // One event per EventCategory so every category's cover image and badge
  // shows on the public Events page. Split across both shelters (shelter1's
  // attributed to the seeded staff member, shelter2 has no staff to
  // attribute to), mostly upcoming, one in the past for the staff Events
  // tab's "Past" badge.
  console.log("Creating events...");
  const eventAt = (days, hours, minutes = 0) => {
    const date = daysFromNow(days);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };
  await prisma.event.createMany({
    data: [
      {
        shelterID: shelter1.shelterID,
        staffID: staff.userID,
        eventCategory: "Adoption_Event",
        eventName: "Monthly Meet & Greet",
        eventDate: eventAt(6, 11),
        eventDesc:
          "Meet our adoptable dogs, cats and rabbits in person. Adoption counsellors will be on hand to answer questions and help you find your match.",
      },
      {
        shelterID: shelter2.shelterID,
        staffID: null,
        eventCategory: "Fundraiser",
        eventName: "Paws in the Park Charity Walk",
        eventDate: eventAt(20, 9),
        eventDesc:
          "A 5K walk through Brooklyn Bridge Park — bring your dog or walk one of ours. Every registration funds a week of food and care for a shelter pet.",
      },
      {
        shelterID: shelter1.shelterID,
        staffID: staff.userID,
        eventCategory: "Volunteer_Orientation",
        eventName: "New Volunteer Orientation",
        eventDate: eventAt(9, 18),
        eventDesc:
          "Start here if you've just signed up to volunteer. We'll cover shelter safety, animal handling basics and how to pick up your first shifts.",
      },
      {
        shelterID: shelter2.shelterID,
        staffID: null,
        eventCategory: "Vaccination_Clinic",
        eventName: "Low-Cost Vaccine & Microchip Clinic",
        eventDate: eventAt(13, 10),
        eventDesc:
          "Rabies, DHPP and FVRCP vaccines plus microchipping at reduced prices for community pets. Walk-ins welcome while supplies last.",
      },
      {
        shelterID: shelter1.shelterID,
        staffID: staff.userID,
        eventCategory: "Community_Outreach",
        eventName: "Pets at the Library Storytime",
        eventDate: eventAt(16, 15, 30),
        eventDesc:
          "Kids read aloud to our calmest shelter dogs at the local library while our team talks about responsible pet ownership.",
      },
      {
        shelterID: shelter2.shelterID,
        staffID: null,
        eventCategory: "Workshop",
        eventName: "Puppy Training 101 Workshop",
        eventDate: eventAt(27, 14),
        eventDesc:
          "A hands-on class covering house training, leash manners and basic commands. Recommended for new and soon-to-be puppy owners.",
      },
      {
        shelterID: shelter1.shelterID,
        staffID: staff.userID,
        eventCategory: "Donation_Drive",
        eventName: "Winter Blanket & Food Drive",
        eventDate: eventAt(34, 10),
        eventDesc:
          "Drop off blankets, towels, unopened pet food and toys to keep our animals warm this winter. Donation receipts available at the desk.",
      },
      {
        shelterID: shelter2.shelterID,
        staffID: null,
        eventCategory: "Other",
        eventName: "Shelter Open House",
        eventDate: eventAt(-10, 12),
        eventDesc:
          "Tour the shelter, meet the team and see where the animals live. Refreshments provided.",
      },
    ],
  });

  console.log("✅ Seeding complete!");
  console.log("");
  console.log("Test accounts:");
  console.log("  Admin:     admin@petpals.com     / Admin@123");
  console.log("  Staff:     staff@petpals.com     / Staff@123");
  console.log("  Vet:       vet@petpals.com       / Vet@123");
  console.log("  Adopter:   adopter@petpals.com   / Adopter@123");
  console.log("  Volunteer: volunteer@petpals.com / Volunteer@123");
  console.log("  Donor:     donor@petpals.com     / Donor@123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
