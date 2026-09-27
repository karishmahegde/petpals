const prisma = require("../../config/prisma");

const notFound = (donationID) => {
  const err = new Error(`No donation exists with ID ${donationID}`);
  err.code = "NOT_FOUND";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error("You may only view donations at your own shelter");
  err.code = "FORBIDDEN";
  return err;
};

// Staff: always their own current shelter (no shelter → a sentinel that can
// never match, same "found nothing" convention as listTransfers). Admin: the
// shelterID param if given, else network-wide (undefined).
const resolveShelterScope = async ({ role, userID }, shelterIDParam) => {
  if (role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID },
      select: { shelterID: true },
    });
    return staff?.shelterID ?? -1;
  }
  return shelterIDParam;
};

// Donor fields staff may see. Never stripeCustomerID (CLAUDE.md: never
// exposed in API responses).
const formatDonor = (donor) => ({
  donorName: donor.donorName,
  donorEmail: donor.user.userEmail,
  donorPhone: donor.donorPhone,
});

// ——————————————— LIST DONATIONS (GET /donations) ———————————————
// Newest first. dateFrom/dateTo (client-computed, so "this month" follows
// the viewer's timezone) bound donationDate; donorName is a case-insensitive
// contains-match.
const listDonations = async (
  actor,
  { dateFrom, dateTo, donorName, shelterID: shelterIDParam, page = 1, limit = 20 } = {},
) => {
  const where = {};
  const shelterID = await resolveShelterScope(actor, shelterIDParam);
  if (shelterID !== undefined) where.shelterID = shelterID;

  if (dateFrom || dateTo) {
    where.donationDate = {
      ...(dateFrom && { gte: dateFrom }),
      ...(dateTo && { lt: dateTo }),
    };
  }
  if (donorName) {
    where.donor = { donorName: { contains: donorName, mode: "insensitive" } };
  }

  const [rows, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      select: {
        donationID: true,
        donationCode: true,
        donationDate: true,
        donationAmt: true,
        donor: { select: { donorName: true } },
      },
      orderBy: { donationDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.donation.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      donationID: row.donationID,
      donationCode: row.donationCode,
      donationDate: row.donationDate,
      donationAmt: row.donationAmt,
      donorName: row.donor.donorName,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— DONATION STATS (GET /donations/stats) ———————————————
// The tab's three tiles, over ALL of the shelter's donations (not the list's
// filters). monthStart is the client's local start-of-month.
const getDonationStats = async (actor, { monthStart, shelterID: shelterIDParam } = {}) => {
  const where = {};
  const shelterID = await resolveShelterScope(actor, shelterIDParam);
  if (shelterID !== undefined) where.shelterID = shelterID;

  const [total, donors, thisMonth] = await Promise.all([
    prisma.donation.aggregate({ where, _sum: { donationAmt: true } }),
    prisma.donation.findMany({ where, distinct: ["donorID"], select: { donorID: true } }),
    prisma.donation.aggregate({
      where: { ...where, donationDate: { gte: monthStart } },
      _sum: { donationAmt: true },
    }),
  ]);

  return {
    totalAmount: total._sum.donationAmt ?? 0,
    totalDonors: donors.length,
    thisMonthAmount: thisMonth._sum.donationAmt ?? 0,
  };
};

// ——————————————— DONATION DETAIL (GET /donations/:id) ———————————————
const getDonationDetail = async (donationID, actor) => {
  const donation = await prisma.donation.findUnique({
    where: { donationID },
    select: {
      donationID: true,
      donationCode: true,
      donationDate: true,
      donationAmt: true,
      donationDesc: true,
      shelterID: true,
      donor: {
        select: {
          donorName: true,
          donorPhone: true,
          user: { select: { userEmail: true } },
        },
      },
    },
  });
  if (!donation) {
    throw notFound(donationID);
  }

  if (actor.role === "Staff") {
    const shelterID = await resolveShelterScope(actor);
    if (donation.shelterID !== shelterID) {
      throw forbiddenShelter();
    }
  }

  const { donor, shelterID, ...rest } = donation;
  return { ...rest, donor: formatDonor(donor) };
};

module.exports = { listDonations, getDonationStats, getDonationDetail };
