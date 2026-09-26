const prisma = require("../../config/prisma");
// Adopter oversight — the list and detail reads are shared by Admin and
// Staff (the Staff dashboard's People → Adopters tab, read-only); the status
// change stays Admin-only.
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
  name,
  page = 1,
  limit = 20,
} = {}) => {
  const where = {};
  if (accountStatus !== undefined) where.accountStatus = accountStatus;
  if (adopterRiskFlag !== undefined) where.adopterRiskFlag = adopterRiskFlag;
  if (name) where.adopterName = { contains: name, mode: "insensitive" };

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

// ——————————————— ADOPTER DETAIL (GET /adopters/:id) ———————————————
// Every profile column an adopter fills in (contact, address, household,
// preferences, flags), plus the preferred breed's name and the government
// ID's verification status only — never the ID itself, and never
// stripeCustomerID (CLAUDE.md's "Never expose" list).
const ADOPTER_DETAIL_SELECT = {
  ...ADOPTER_LIST_SELECT,
  adopterDOB: true,
  adopterSex: true,
  addressLine1: true,
  addressLine2: true,
  zip: true,
  housingType: true,
  ownsOrRents: true,
  landlordContact: true,
  householdSize: true,
  numChildren: true,
  employmentStatus: true,
  activityLevel: true,
  yardAvailable: true,
  petExperience: true,
  currentPets: true,
  preferredAgeRange: true,
  preferredSize: true,
  openToSpecialNeeds: true,
  onboardingComplete: true,
  preferredBreed: { select: { breedName: true } },
  // emailVerified/lastLoginAt live on Users (account-level).
  user: { select: { userEmail: true, emailVerified: true, lastLoginAt: true } },
};

const getAdopterDetail = async (userID) => {
  const [adopter, governmentId] = await Promise.all([
    prisma.adopter.findUnique({
      where: { userID },
      select: ADOPTER_DETAIL_SELECT,
    }),
    prisma.governmentID.findFirst({
      where: { userID, userType: "Adopter" },
      select: { verificationStatus: true },
    }),
  ]);
  if (!adopter) {
    throw notFound(userID);
  }

  const { user, preferredBreed, ...rest } = adopter;
  return {
    ...rest,
    adopterEmail: user.userEmail,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    preferredBreedName: preferredBreed?.breedName ?? null,
    governmentIdStatus: governmentId?.verificationStatus ?? null,
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

module.exports = { listAdopters, getAdopterDetail, updateAdopterStatus };
