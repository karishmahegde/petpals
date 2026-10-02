const prisma = require("../../config/prisma");
const { ADDRESS_SELECT } = require("../../utils/address");

// Self-service shape — everything a vet may see about their own row. Email
// via the `user` relation only, so userPassword/refreshToken can't leak.
// Mirrors staff.service.js's STAFF_SELF_SELECT (and the same toSelfProfile
// flattening) so the frontend onboarding wizard can reuse one shape; a vet
// simply has no staffDOJ/staffDOS/staffDesignation, and has createdAt.
const VET_SELF_SELECT = {
  userID: true,
  avatarSeed: true,
  vetName: true,
  vetPhone: true,
  shelterID: true,
  vetDOB: true,
  vetSex: true,
  createdAt: true,
  accountStatus: true,
  onboardingComplete: true,
  onboardingStep: true,
  ...ADDRESS_SELECT,
  shelter: { select: { shelterName: true } },
  // emailVerified/lastLoginAt live on Users — flattened by toSelfProfile.
  user: { select: { userEmail: true, emailVerified: true, lastLoginAt: true } },
};

const notFound = () => {
  const err = new Error("No veterinarian record exists for this account");
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET /vets/me ———————————————
// user.userEmail stays nested; emailVerified/lastLoginAt are lifted to the
// top level — same as GET /staff/me.
const toSelfProfile = ({ user, ...rest }) => ({
  ...rest,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  user: { userEmail: user.userEmail },
});

const getMyProfile = async (userID) => {
  const vet = await prisma.veterinarian.findUnique({
    where: { userID },
    select: VET_SELF_SELECT,
  });
  if (!vet) {
    throw notFound();
  }
  return toSelfProfile(vet);
};

// ——————————————— PUT /vets/me ———————————————
// `data` is already validated and whitelisted by the controller — only
// avatarSeed/vetName/vetPhone/vetDOB/vetSex and the address fields, never
// shelterID/accountStatus (the shelter is picked at sign-up; approval is the
// shelter manager's, via PATCH /staff/me/vets/:id/status).
const updateMyProfile = async (userID, data) => {
  try {
    return toSelfProfile(
      await prisma.veterinarian.update({
        where: { userID },
        data,
        select: VET_SELF_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound();
    }
    throw err;
  }
};

// ——————————————— ONBOARDING (PATCH /vets/me/onboarding-step, /onboarding-complete) ———————————————
// A new vet onboards while still Pending, before approval (see
// authenticate.allowPending): Step 2 Personal, 3 Address, 4 Identity,
// 5 Review — the same steps as the staff wizard.
const LAST_ONBOARDING_STEP = 5;

// `step` is the wizard step just completed (validated 2-5 by the
// controller). onboardingStep only ever advances, whatever the client sends.
const advanceOnboardingStep = async (userID, step) => {
  const vet = await prisma.veterinarian.findUnique({
    where: { userID },
    select: { onboardingStep: true },
  });
  if (!vet) {
    throw notFound();
  }

  const nextStep = Math.min(
    Math.max(vet.onboardingStep, step + 1),
    LAST_ONBOARDING_STEP,
  );
  return toSelfProfile(
    await prisma.veterinarian.update({
      where: { userID },
      data: { onboardingStep: nextStep },
      select: VET_SELF_SELECT,
    }),
  );
};

// Checked server-side rather than trusting the wizard's own required-field
// checks, since this endpoint could be called directly. A submitted
// government ID is required too; the shelter manager verifies it before
// approving.
const REQUIRED_FOR_COMPLETION = {
  vetPhone: "Phone",
  vetDOB: "Date of birth",
  vetSex: "Sex",
  addressLine1: "Address line 1",
  city: "City",
  state: "State",
  zip: "ZIP",
  country: "Country",
};

const completeOnboarding = async (userID) => {
  const vet = await prisma.veterinarian.findUnique({
    where: { userID },
    select: Object.fromEntries(
      Object.keys(REQUIRED_FOR_COMPLETION).map((field) => [field, true]),
    ),
  });
  if (!vet) {
    throw notFound();
  }

  const missingLabels = Object.entries(REQUIRED_FOR_COMPLETION)
    .filter(([field]) => {
      const value = vet[field];
      return value === null || value === undefined || value === "";
    })
    .map(([, label]) => label);

  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Veterinarian" },
    select: { governmentIDID: true },
  });
  if (!governmentId) {
    missingLabels.push("Government ID");
  }

  // 409, same as /staff/me/onboarding-complete, so the shared wizard
  // handles both roles identically.
  if (missingLabels.length > 0) {
    const err = new Error(
      `Onboarding is incomplete — missing: ${missingLabels.join(", ")}`,
    );
    err.code = "CONFLICT";
    throw err;
  }

  return toSelfProfile(
    await prisma.veterinarian.update({
      where: { userID },
      data: { onboardingComplete: true, onboardingStep: LAST_ONBOARDING_STEP },
      select: VET_SELF_SELECT,
    }),
  );
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  advanceOnboardingStep,
  completeOnboarding,
};
