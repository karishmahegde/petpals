// npm run test:leftovers — a read-only report of test data still in the
// database (the integration suites run against the dev database). It deletes
// nothing; clearing anything it finds is a deliberate step.
//
// What counts as test data: logins and shelters with an @ex.com email (every
// suite's uniqueEmail() and shelter emails use it; the seed uses
// @petpals.com), what hangs off them, and species or vaccines the seed
// doesn't create.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const prisma = require("../../../config/prisma");

const TEST_DOMAIN = "@ex.com";

// The seed's own species and vaccine names, read from seed.js so this stays
// right when the seed changes.
const seedNames = () => {
  const seed = fs.readFileSync(path.join(__dirname, "../../../prisma/seed.js"), "utf8");
  const speciesBlock = seed.match(/const speciesBreeds = \{([\s\S]*?)\n {2}\};/)?.[1] ?? "";
  const species = [...speciesBlock.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  const vaccines = [...seed.matchAll(/vaccineName: "([^"]+)"/g)].map((m) => m[1]);
  return { species, vaccines };
};

const main = async () => {
  const { species: seedSpecies, vaccines: seedVaccines } = seedNames();

  const users = await prisma.users.findMany({
    where: { userEmail: { endsWith: TEST_DOMAIN } },
    select: { userID: true, userEmail: true, role: true },
    orderBy: { userID: "asc" },
  });
  const shelters = await prisma.shelter.findMany({
    where: { shelterEmail: { endsWith: TEST_DOMAIN } },
    select: { shelterID: true, shelterName: true },
  });
  const species = await prisma.species.findMany({
    where: { speciesName: { notIn: seedSpecies } },
    select: { speciesID: true, speciesName: true, breeds: { select: { breedID: true, breedName: true } } },
  });
  const vaccines = await prisma.vaccine.findMany({
    where: { vaccineName: { notIn: seedVaccines } },
    select: { vaccineID: true, vaccineName: true },
  });
  const pets = await prisma.pet.findMany({
    where: {
      OR: [
        { shelterID: { in: shelters.map((s) => s.shelterID) } },
        { breed: { speciesID: { in: species.map((s) => s.speciesID) } } },
      ],
    },
    select: { petID: true, petName: true, shelterID: true },
  });

  const sections = [
    ["Test logins (@ex.com)", users.map((u) => `#${u.userID} ${u.userEmail} (${u.role})`)],
    ["Test shelters (@ex.com)", shelters.map((s) => `#${s.shelterID} ${s.shelterName}`)],
    [
      "Species the seed doesn't create",
      species.map(
        (s) => `#${s.speciesID} ${s.speciesName}${s.breeds.length ? ` — breeds: ${s.breeds.map((b) => b.breedName).join(", ")}` : ""}`,
      ),
    ],
    ["Vaccines the seed doesn't create", vaccines.map((v) => `#${v.vaccineID} ${v.vaccineName}`)],
    ["Pets at those shelters or of those species", pets.map((p) => `#${p.petID} ${p.petName} (shelter ${p.shelterID})`)],
  ];

  const total = sections.reduce((sum, [, rows]) => sum + rows.length, 0);
  if (total === 0) {
    console.log("No test data left in the database.");
    return 0;
  }
  console.log(`Test data still in the database (${total} rows, read-only report — nothing deleted):\n`);
  for (const [title, rows] of sections) {
    if (rows.length === 0) continue;
    console.log(`${title}: ${rows.length}`);
    for (const row of rows) console.log(`  ${row}`);
    console.log();
  }
  console.log("Species or vaccines added by hand through the app would also show here — check before removing.");
  return 1;
};

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exitCode = code;
  })
  .catch(async (err) => {
    console.error(`Couldn't check for leftovers: ${err.message}`);
    await prisma.$disconnect();
    process.exitCode = 2;
  });
