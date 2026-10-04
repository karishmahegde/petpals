const prisma = require("../../config/prisma");
const { nullifyRefreshToken } = require("../auth/auth.service");
const { ADDRESS_SELECT } = require("../../utils/address");

// Self-service shape — everything a donor may see about their own row. Email
// via the `user` relation only, so userPassword/refreshToken can't leak, and
// never stripeCustomerID (CLAUDE.md: never exposed in API responses). Same
// toSelfProfile flattening as /vets/me and /volunteers/me.
const DONOR_SELF_SELECT = {
  userID: true,
  avatarSeed: true,
  donorName: true,
  donorPhone: true,
  donorDOB: true,
  donorSex: true,
  createdAt: true,
  accountStatus: true,
  onboardingComplete: true,
  onboardingStep: true,
  ...ADDRESS_SELECT,
  // emailVerified/lastLoginAt live on Users — flattened by toSelfProfile.
  user: { select: { userEmail: true, emailVerified: true, lastLoginAt: true } },
};

const notFound = () => {
  const err = new Error("No donor record exists for this account");
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET /donors/me ———————————————
const toSelfProfile = ({ user, ...rest }) => ({
  ...rest,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  user: { userEmail: user.userEmail },
});

const getMyProfile = async (userID) => {
  const donor = await prisma.donor.findUnique({
    where: { userID },
    select: DONOR_SELF_SELECT,
  });
  if (!donor) {
    throw notFound();
  }
  return toSelfProfile(donor);
};

// ——————————————— PUT /donors/me ———————————————
// `data` is already validated and whitelisted by the controller — only
// avatarSeed/donorName/donorPhone/donorDOB/donorSex and the address fields,
// never accountStatus or stripeCustomerID.
const updateMyProfile = async (userID, data) => {
  try {
    return toSelfProfile(
      await prisma.donor.update({
        where: { userID },
        data,
        select: DONOR_SELF_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound();
    }
    throw err;
  }
};

// ——————————————— ONBOARDING (PATCH /donors/me/onboarding-step, /onboarding-complete) ———————————————
// Step 2 Personal, 3 Address, 4 Review — no government ID (donors don't
// submit one) and no approval (donors are Active from sign-up). The wizard
// is skippable on the client, like the adopter's; donating never waits on it.
const LAST_ONBOARDING_STEP = 4;

// `step` is the wizard step just completed (validated 2-4 by the
// controller). onboardingStep only ever advances, whatever the client sends.
const advanceOnboardingStep = async (userID, step) => {
  const donor = await prisma.donor.findUnique({
    where: { userID },
    select: { onboardingStep: true },
  });
  if (!donor) {
    throw notFound();
  }

  const nextStep = Math.min(
    Math.max(donor.onboardingStep, step + 1),
    LAST_ONBOARDING_STEP,
  );
  return toSelfProfile(
    await prisma.donor.update({
      where: { userID },
      data: { onboardingStep: nextStep },
      select: DONOR_SELF_SELECT,
    }),
  );
};

// Checked server-side rather than trusting the wizard's own required-field
// checks, since this endpoint could be called directly.
const REQUIRED_FOR_COMPLETION = {
  donorPhone: "Phone",
  donorDOB: "Date of birth",
  donorSex: "Sex",
  addressLine1: "Address line 1",
  city: "City",
  state: "State",
  zip: "ZIP",
  country: "Country",
};

const completeOnboarding = async (userID) => {
  const donor = await prisma.donor.findUnique({
    where: { userID },
    select: Object.fromEntries(
      Object.keys(REQUIRED_FOR_COMPLETION).map((field) => [field, true]),
    ),
  });
  if (!donor) {
    throw notFound();
  }

  const missingLabels = Object.entries(REQUIRED_FOR_COMPLETION)
    .filter(([field]) => {
      const value = donor[field];
      return value === null || value === undefined || value === "";
    })
    .map(([, label]) => label);

  // 409, same as every other role's onboarding-complete.
  if (missingLabels.length > 0) {
    const err = new Error(
      `Onboarding is incomplete — missing: ${missingLabels.join(", ")}`,
    );
    err.code = "CONFLICT";
    throw err;
  }

  return toSelfProfile(
    await prisma.donor.update({
      where: { userID },
      data: { onboardingComplete: true, onboardingStep: LAST_ONBOARDING_STEP },
      select: DONOR_SELF_SELECT,
    }),
  );
};

// ——————————————— CLOSE MY ACCOUNT (DELETE /donors/me) ———————————————
// Nothing blocks a donor from leaving — there's no open work to hand over.
// 'deactivate' keeps the row (accountStatus → Deactivated, refresh token
// cleared). 'delete' removes the Donor and Users rows (the refresh token goes
// with Users). The shelters' records survive either way: Donation.donorID is
// ON DELETE SET NULL, so every donation stays, just with no donor attached
// (staff see "Former donor").
const closeMyAccount = async (userID, mode) => {
  if (mode === "deactivate") {
    await prisma.$transaction([
      prisma.donor.update({
        where: { userID },
        data: { accountStatus: "Deactivated" },
      }),
      nullifyRefreshToken(prisma, userID),
    ]);
    return;
  }

  await prisma.$transaction([
    prisma.donor.delete({ where: { userID } }),
    prisma.users.delete({ where: { userID } }),
  ]);
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  advanceOnboardingStep,
  completeOnboarding,
  closeMyAccount,
};
