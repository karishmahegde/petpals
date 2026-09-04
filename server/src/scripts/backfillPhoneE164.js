// One-off backfill: existing phone numbers predate E.164 standardization and
// are stored as bare US digit strings (no country code). Run once, by hand:
//   node src/scripts/backfillPhoneE164.js
// Not wired into app startup or seeding — safe to delete once run against
// every environment that needs it. Assumes existing numbers are US, matching
// how they were originally seeded/entered.
require("dotenv").config();
const prisma = require("../config/prisma");

const TABLES = [
  { table: "Adopter", column: "adopterPhone" },
  { table: "Staff", column: "staffPhone" },
  { table: "Veterinarian", column: "vetPhone" },
  { table: "Volunteer", column: "volunteerPhone" },
  { table: "Donor", column: "donorPhone" },
  { table: "Shelter", column: "shelterPhone" },
];

async function main() {
  for (const { table, column } of TABLES) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "${column}" = '+1' || "${column}" WHERE "${column}" IS NOT NULL AND "${column}" NOT LIKE '+%'`,
    );
    console.log(`${table}.${column}: ${result} row(s) updated`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
