const { PrismaClient } = require("@prisma/client"); //Prisma object library
const { PrismaPg } = require("@prisma/adapter-pg"); //Posgres specific adapter

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL }); //Adapter object

// Every transaction — batch $transaction([...]) included, since the driver
// adapter runs those as real transactions too — gets 10s to acquire a
// connection and 15s to finish. Prisma's defaults (2s / 5s) are too tight
// over a slow link to the remote database, where a fresh connection alone
// can take a few seconds and a timeout fails the whole request with a 500.
const TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 15000 };

//Create the prisma client and pass the adpater
const prisma = new PrismaClient({ adapter, transactionOptions: TRANSACTION_OPTIONS });

module.exports = prisma;
