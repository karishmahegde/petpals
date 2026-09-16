const prisma = require("../../config/prisma");
const { nullifyRefreshToken } = require("../auth/auth.service");

const notFound = (userID) => {
  const err = new Error(`No adopter exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

// Adopter's own columns for oversight, plus userEmail for identification —
// governmentID and stripeCustomerID are deliberately absent, never exposed.
const ADOPTER_LIST_SELECT = {
  userID: true,
  avatarSeed: true,
  adopterName: true,
  adopterPhone: true,
  accountStatus: true,
  adopterRiskFlag: true,
  preQualifyFlag: true,
  createdAt: true,
  city: true,
  state: true,
  country: true,
  user: { select: { userEmail: true } },
};

// ——————————————— LIST ADOPTERS (GET /adopters) ———————————————
const listAdopters = async ({
  accountStatus,
  adopterRiskFlag,
  page = 1,
  limit = 20,
} = {}) => {
  const where = {};
  if (accountStatus !== undefined) where.accountStatus = accountStatus;
  if (adopterRiskFlag !== undefined) where.adopterRiskFlag = adopterRiskFlag;

  const [data, total] = await Promise.all([
    prisma.adopter.findMany({
      where,
      select: ADOPTER_LIST_SELECT,
      orderBy: { adopterName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adopter.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— UPDATE STATUS (PATCH /adopters/:id/status) ———————————————
// Login already rejects Banned/Deactivated adopters (auth.service.js's
// role-agnostic accountStatus check), but that only stops a *new* login — an
// already-issued refresh token would otherwise keep minting fresh access
// tokens for up to 7 days. Nulling it here — same helper closeAccount's own
// 'deactivate' mode uses — closes that gap immediately instead of waiting on
// token expiry.
const updateAdopterStatus = async (userID, accountStatus) => {
  const operations = [
    prisma.adopter.update({ where: { userID }, data: { accountStatus } }),
  ];
  if (accountStatus !== "Active") {
    operations.push(nullifyRefreshToken(prisma, userID));
  }

  try {
    await prisma.$transaction(operations);
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(userID);
    }
    throw err;
  }

  return prisma.adopter.findUnique({
    where: { userID },
    select: ADOPTER_LIST_SELECT,
  });
};

module.exports = { listAdopters, updateAdopterStatus };
