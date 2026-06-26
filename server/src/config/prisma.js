const { PrismaClient } = require("@prisma/client"); //Prisma object library
const { PrismaPg } = require("@prisma/adapter-pg"); //Posgres specific adapter

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL }); //Adapter object
const prisma = new PrismaClient({ adapter }); //Create the prisma client and pass the adpater

module.exports = prisma;
