// PetPals — Seed Script
// Run with: npx prisma db seed
// Creates: 2 shelters, species, breeds, 17 pets, 1 test user per role

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcrypt");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUPABASE_URL =
  "https://aulounxhkawyqqzjeeqi.supabase.co/storage/v1/object/public/pet-photos";

async function main() {
  console.log("🌱 Seeding PetPals database...");

  // ── ADMIN ────────────────────────────────────────────────────
  console.log("Creating admin...");
  const admin = await prisma.admin.upsert({
    where: { adminEmail: "admin@petpals.com" },
    update: {},
    create: {
      adminName: "Isabella Martinez",
      adminEmail: "admin@petpals.com",
      adminPassword: await bcrypt.hash("Admin@123", 10),
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
      shelterPhone: "2125550101",
      shelterEmail: "downtown@petpals.com",
      shelterZIP: 10001,
      shelterSize: 50,
      shelterStatus: "Open",
    },
  });

  // shelterLocation is a PostGIS geography column — Prisma can't set this via
  // the normal create()/update() data object, since the type isn't modeled in
  // schema.prisma. Set it with a raw query instead, right after the row exists.
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
      shelterPhone: "7185550202",
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
  const staff = await prisma.staff.upsert({
    where: { staffEmail: "staff@petpals.com" },
    update: {},
    create: {
      staffName: "Sasha Grey",
      staffEmail: "staff@petpals.com",
      staffPassword: await bcrypt.hash("Staff@123", 10),
      staffPhone: "2125550103",
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
    data: { managerStaffID: staff.staffID },
  });

  // ── VETERINARIAN ─────────────────────────────────────────────
  console.log("Creating vet...");
  const vet = await prisma.veterinarian.upsert({
    where: { vetEmail: "vet@petpals.com" },
    update: {},
    create: {
      vetName: "Jay Asarathi",
      vetEmail: "vet@petpals.com",
      vetPassword: await bcrypt.hash("Vet@123", 10),
      vetPhone: "2125550104",
      vetAddress: "789 Oak Lane, New York, NY 10002",
      vetDOB: new Date("1980-07-22"),
      vetSex: "M",
      shelterID: shelter1.shelterID,
      isActive: true,
      accountStatus: "Active",
    },
  });

  // ── ADOPTER ──────────────────────────────────────────────────
  console.log("Creating adopter...");
  await prisma.adopter.upsert({
    where: { adopterEmail: "adopter@petpals.com" },
    update: {},
    create: {
      adopterName: "Emelie Archer",
      adopterEmail: "adopter@petpals.com",
      adopterPassword: await bcrypt.hash("Adopter@123", 10),
      adopterPhone: "2125550105",
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
      adopterType: "Owner",
      emailVerified: true,
      accountStatus: "Active",
    },
  });

  // ── VOLUNTEER ────────────────────────────────────────────────
  console.log("Creating volunteer...");
  const volunteerApp = await prisma.volunteerApplication.create({
    data: {
      shelterID: shelter1.shelterID,
      applicationStatus: "Accepted",
    },
  });

  const volunteer = await prisma.volunteer.upsert({
    where: { volunteerEmail: "volunteer@petpals.com" },
    update: {},
    create: {
      volunteerName: "Bryan Smith",
      volunteerEmail: "volunteer@petpals.com",
      volunteerPassword: await bcrypt.hash("Volunteer@123", 10),
      volunteerPhone: "2125550106",
      volunteerAddress: "321 Elm Street, Chicago, IL 60601",
      volunteerDOB: new Date("2005-09-18"),
      volunteerSex: "M",
      volunteerSchedule: "Weekends 9am-5pm",
      shelterID: shelter1.shelterID,
      volunteerStatus: true,
    },
  });

  await prisma.volunteerApplication.update({
    where: { applicationID: volunteerApp.applicationID },
    data: { volunteerID: volunteer.volunteerID },
  });

  // ── DONOR ────────────────────────────────────────────────────
  console.log("Creating donor...");
  await prisma.donor.upsert({
    where: { donorEmail: "donor@petpals.com" },
    update: {},
    create: {
      donorName: "Charlotte Salazar",
      donorEmail: "donor@petpals.com",
      donorPassword: await bcrypt.hash("Donor@123", 10),
      donorPhone: "2125550107",
      donorAddress: "654 Pine Road, California, CA 90001",
      donorDOB: new Date("1958-04-30"),
      donorSex: "F",
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

  // ── PETS ─────────────────────────────────────────────────────
  console.log("Creating pets...");
  const pets = [
    {
      petName: "Apollo",
      breedID: germanShepherd.breedID,
      petAge: 4,
      petWeight: 32.0,
      petHeight: 62.0,
      petBGroup: "DEA4",
      petColor: "Black and Tan",
      petSize: "Large",
      petPhoto: `${SUPABASE_URL}/Apollo.png`,
      petSex: "M",
      petDesc:
        "Apollo is a confident and loyal German Shepherd who takes his role as protector seriously. He thrives with experienced owners who can match his intelligence and energy. Best suited as the only pet in the home.",
      intakeDate: new Date("2024-03-10"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Buddy",
      breedID: goldenRetriever.breedID,
      petAge: 2,
      petWeight: 28.5,
      petHeight: 58.0,
      petBGroup: "DEA1",
      petColor: "Golden",
      petSize: "Large",
      petPhoto: `${SUPABASE_URL}/Buddy.png`,
      petSex: "M",
      petDesc:
        "Buddy is the definition of a family dog — endlessly cheerful, gentle with kids, and a best friend to every dog he meets. He loves fetch, swimming, and curling up on the couch after a long walk.",
      intakeDate: new Date("2024-06-01"),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Biscuit",
      breedID: beagle.breedID,
      petAge: 6,
      petWeight: 10.5,
      petHeight: 38.0,
      petBGroup: "DEA3",
      petColor: "Tricolor",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/Biscuit.png`,
      petSex: "M",
      petDesc:
        "Biscuit is a nose-to-the-ground explorer who never meets a smell he doesn't investigate. Calm and affectionate at home, he loves children and is happiest on long morning walks.",
      intakeDate: new Date("2024-01-20"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Daisy",
      breedID: labrador.breedID,
      petAge: 1,
      petWeight: 22.0,
      petHeight: 55.0,
      petBGroup: "DEA1",
      petColor: "Yellow",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/Daisy.png`,
      petSex: "F",
      petDesc:
        "Daisy is a bouncy young Lab who is still learning the ropes. She is eager to please and picks up new commands quickly. She adores children and other dogs — the more the merrier.",
      intakeDate: new Date("2024-08-15"),
      intakeType: "stray",
      adoptionStatus: "pending",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Rocky",
      breedID: bulldog.breedID,
      petAge: 8,
      petWeight: 24.0,
      petHeight: 40.0,
      petBGroup: "DEA4",
      petColor: "Brindle",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/Rocky.png`,
      petSex: "M",
      petDesc:
        "Rocky is a laid-back senior Bulldog who asks for little more than a comfy sofa and a patient owner. He has a mild heart condition that requires monthly vet visits but is otherwise healthy and full of personality.",
      intakeDate: new Date("2023-11-05"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: true,
    },
    {
      petName: "Zeus",
      breedID: rottweiler.breedID,
      petAge: 3,
      petWeight: 45.0,
      petHeight: 65.0,
      petBGroup: "DEA3",
      petColor: "Black and Mahogany",
      petSize: "Large",
      petPhoto: `${SUPABASE_URL}/Zeus.PNG`,
      petSex: "M",
      petDesc:
        "Zeus is a powerful and disciplined Rottweiler who is deeply loyal to those he trusts. He requires an experienced handler and a home without other animals. With the right owner, he is an incredibly devoted companion.",
      intakeDate: new Date("2024-04-22"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Teddy",
      breedID: toyPoodle.breedID,
      petAge: 0,
      petWeight: 1.2,
      petHeight: 18.0,
      petBGroup: "DEA1",
      petColor: "Apricot",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Teddy.png`,
      petSex: "M",
      petDesc:
        "Teddy is a fluffy 4-month-old Toy Poodle puppy who is curious about everything and afraid of nothing. He is still learning basic commands and would thrive with a patient first-time owner. Gets along wonderfully with kids and other pets.",
      intakeDate: new Date("2025-02-01"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Cleo",
      breedID: siamese.breedID,
      petAge: 3,
      petWeight: 4.2,
      petHeight: 28.0,
      petBGroup: "AB",
      petColor: "Seal Point",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Cleo.png`,
      petSex: "F",
      petDesc:
        "Cleo is a vocal and opinionated Siamese who knows exactly what she wants. She forms deep bonds with her person but prefers to be the only animal in the home. Perfect for someone who wants a cat with real personality.",
      intakeDate: new Date("2024-05-10"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: false,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Mittens",
      breedID: domShorthair.breedID,
      petAge: 5,
      petWeight: 4.8,
      petHeight: 25.0,
      petBGroup: "A",
      petColor: "White and Grey",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Mittens.png`,
      petSex: "F",
      petDesc:
        "Mittens is a gentle and easygoing cat who gets along with everyone — children, dogs, other cats. She loves sunny windowsills and will happily sit on a lap for hours. A wonderful first cat for any household.",
      intakeDate: new Date("2023-09-14"),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Shadow",
      breedID: britShorthair.breedID,
      petAge: 7,
      petWeight: 5.5,
      petHeight: 30.0,
      petBGroup: "B",
      petColor: "Blue Grey",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Shadow.png`,
      petSex: "M",
      petDesc:
        "Shadow found his forever home and is now thriving with his new family. A calm and dignified British Shorthair who won everyone over with his quiet affection.",
      intakeDate: new Date("2023-06-01"),
      intakeType: "surrendered",
      adoptionStatus: "adopted",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Mochi",
      breedID: persian.breedID,
      petAge: 0,
      petWeight: 0.8,
      petHeight: 15.0,
      petBGroup: "A",
      petColor: "Cream",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Mochi.png`,
      petSex: "F",
      petDesc:
        "Mochi is a 3-month-old Persian kitten with a cloud-like coat and the most expressive eyes. She is playful and sociable, already comfortable around children and other pets. She will need regular grooming.",
      intakeDate: new Date("2025-03-15"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Simba",
      breedID: maineCoon.breedID,
      petAge: 1,
      petWeight: 5.0,
      petHeight: 32.0,
      petBGroup: "AB",
      petColor: "Brown Tabby",
      petSize: "Medium",
      petPhoto: `${SUPABASE_URL}/Simba.png`,
      petSex: "M",
      petDesc:
        "Simba is a playful young Maine Coon who thinks he is much bigger than he is. He is endlessly curious, loves to climb, and chirps at birds through the window. Great with kids and other cats.",
      intakeDate: new Date("2024-10-08"),
      intakeType: "stray",
      adoptionStatus: "pending",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Polly",
      breedID: parrot.breedID,
      petAge: 10,
      petWeight: 0.5,
      petHeight: 30.0,
      petBGroup: "N/A",
      petPhoto: `${SUPABASE_URL}/Polly.png`,
      petColor: "Green and Red",
      petSize: "Small",
      petSex: "F",
      petDesc:
        "Polly is a remarkably intelligent 10-year-old parrot with a vocabulary of over 50 words. She needs mental stimulation, daily interaction, and a quiet home environment. Not suitable for homes with young children.",
      intakeDate: new Date("2024-02-14"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Bloo",
      breedID: blueMacaw.breedID,
      petAge: 6,
      petWeight: 1.2,
      petHeight: 75.0,
      petBGroup: "N/A",
      petColor: "Blue",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Bloo.png`,
      petSex: "M",
      petDesc:
        "Bloo is a stunning Blue Macaw with a bold personality to match his striking plumage. He is social and vocal, and bonds deeply with his owner. Requires an experienced bird owner and a large enclosure.",
      intakeDate: new Date("2024-07-30"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: false,
      compatibleWithPets: false,
      specialNeeds: false,
    },
    {
      petName: "Nimbus",
      breedID: pigeon.breedID,
      petAge: 2,
      petWeight: 0.4,
      petHeight: 32.0,
      petBGroup: "N/A",
      petColor: "Grey and White",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Nimbus.png`,
      petSex: "M",
      petDesc:
        "Nimbus is a rescue pigeon who was found injured and nursed back to health. He is calm, gentle and surprisingly affectionate. He gets along well with other birds and is a wonderful low-maintenance companion.",
      intakeDate: new Date("2024-09-05"),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Sky",
      breedID: pigeon.breedID,
      petAge: 1,
      petWeight: 0.35,
      petHeight: 30.0,
      petBGroup: "N/A",
      petColor: "White",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Sky.png`,
      petSex: "F",
      petDesc:
        "Sky is a young white pigeon with a calm and trusting nature. She was rescued from a city rooftop and has since become very comfortable around people. A peaceful and easy companion for the right home.",
      intakeDate: new Date("2025-01-20"),
      intakeType: "stray",
      adoptionStatus: "available",
      shelterID: shelter2.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
    {
      petName: "Pebbles",
      breedID: hollowLop.breedID,
      petAge: 2,
      petWeight: 1.8,
      petHeight: 20.0,
      petBGroup: "N/A",
      petColor: "Grey and White",
      petSize: "Small",
      petPhoto: `${SUPABASE_URL}/Pebbles.png`,
      petSex: "F",
      petDesc:
        "Pebbles is a sweet Holland Lop rabbit who loves to binky around the room and then flop dramatically by your feet. She is litter trained, gentle with children, and gets along well with other small animals.",
      intakeDate: new Date("2024-11-12"),
      intakeType: "surrendered",
      adoptionStatus: "available",
      shelterID: shelter1.shelterID,
      staffID: staff.staffID,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: false,
    },
  ];

  for (const pet of pets) {
    await prisma.pet.create({ data: pet });
  }

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
