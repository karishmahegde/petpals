const prisma = require("../../config/prisma");
const { ADDRESS_SELECT } = require("../../utils/address");
const {
  decodeAvailability,
  encodeAvailability,
} = require("../../utils/availability");

// Self-service shape — everything a volunteer may see about their own row.
// Email via the `user` relation only, so userPassword/refreshToken can't
// leak. Mirrors vet/vets.service.js's VET_SELF_SELECT (and the same
// toSelfProfile flattening) so the frontend onboarding wizard reuses one
// shape; a volunteer also has their human-facing volunteerCode and their
// weekly availability (volunteerSchedule).
const VOLUNTEER_SELF_SELECT = {
  userID: true,
  volunteerCode: true,
  avatarSeed: true,
  volunteerName: true,
  volunteerPhone: true,
  shelterID: true,
  volunteerDOB: true,
  volunteerSex: true,
  volunteerSchedule: true,
  createdAt: true,
  accountStatus: true,
  onboardingComplete: true,
  onboardingStep: true,
  ...ADDRESS_SELECT,
  // Contact details for the dashboard's Shelter Details card — the same
  // fields the public GET /shelters already shows.
  shelter: {
    select: {
      shelterName: true,
      shelterAddress: true,
      shelterPhone: true,
      shelterEmail: true,
    },
  },
  // emailVerified/lastLoginAt live on Users — flattened by toSelfProfile.
  user: { select: { userEmail: true, emailVerified: true, lastLoginAt: true } },
};

const notFound = () => {
  const err = new Error("No volunteer record exists for this account");
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET /volunteers/me ———————————————
// user.userEmail stays nested; emailVerified/lastLoginAt are lifted to the
// top level — same as GET /vets/me and GET /staff/me. `availability` is
// volunteerSchedule decoded to { Mon: ["Morning", …], … } — null when the
// stored value is free text from before availability was structured, in
// which case volunteerSchedule (always returned as stored) is all there is.
const toSelfProfile = ({ user, ...rest }) => ({
  ...rest,
  availability: decodeAvailability(rest.volunteerSchedule),
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  user: { userEmail: user.userEmail },
});

const getMyProfile = async (userID) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID },
    select: VOLUNTEER_SELF_SELECT,
  });
  if (!volunteer) {
    throw notFound();
  }
  return toSelfProfile(volunteer);
};

// ——————————————— PUT /volunteers/me ———————————————
// `data` is already validated and whitelisted by the controller — only
// avatarSeed/volunteerName/volunteerPhone/volunteerDOB/volunteerSex and the
// address fields, never shelterID/accountStatus (the shelter is picked at
// sign-up; approval is the shelter staff's, via PATCH
// /volunteers/:id/status).
const updateMyProfile = async (userID, data) => {
  try {
    return toSelfProfile(
      await prisma.volunteer.update({
        where: { userID },
        data,
        select: VOLUNTEER_SELF_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound();
    }
    throw err;
  }
};

// ——————————————— PUT /volunteers/me/availability ———————————————
// `availability` is already validated and canonical (the controller's
// parseAvailabilityInput). Replaces the whole week — an empty object clears
// it (stored as null).
const updateMyAvailability = async (userID, availability) => {
  try {
    return toSelfProfile(
      await prisma.volunteer.update({
        where: { userID },
        data: { volunteerSchedule: encodeAvailability(availability) },
        select: VOLUNTEER_SELF_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound();
    }
    throw err;
  }
};

// ——————————————— ONBOARDING (PATCH /volunteers/me/onboarding-step, /onboarding-complete) ———————————————
// A new volunteer onboards while still Pending, before approval (see
// authenticate.allowPending): Step 2 Personal, 3 Address, 4 Identity,
// 5 Review — the same steps as the staff and vet wizards.
const LAST_ONBOARDING_STEP = 5;

// `step` is the wizard step just completed (validated 2-5 by the
// controller). onboardingStep only ever advances, whatever the client sends.
const advanceOnboardingStep = async (userID, step) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID },
    select: { onboardingStep: true },
  });
  if (!volunteer) {
    throw notFound();
  }

  const nextStep = Math.min(
    Math.max(volunteer.onboardingStep, step + 1),
    LAST_ONBOARDING_STEP,
  );
  return toSelfProfile(
    await prisma.volunteer.update({
      where: { userID },
      data: { onboardingStep: nextStep },
      select: VOLUNTEER_SELF_SELECT,
    }),
  );
};

// Checked server-side rather than trusting the wizard's own required-field
// checks, since this endpoint could be called directly. A submitted
// government ID is required too; shelter staff verify it before approving.
const REQUIRED_FOR_COMPLETION = {
  volunteerPhone: "Phone",
  volunteerDOB: "Date of birth",
  volunteerSex: "Sex",
  addressLine1: "Address line 1",
  city: "City",
  state: "State",
  zip: "ZIP",
  country: "Country",
};

const completeOnboarding = async (userID) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID },
    select: Object.fromEntries(
      Object.keys(REQUIRED_FOR_COMPLETION).map((field) => [field, true]),
    ),
  });
  if (!volunteer) {
    throw notFound();
  }

  const missingLabels = Object.entries(REQUIRED_FOR_COMPLETION)
    .filter(([field]) => {
      const value = volunteer[field];
      return value === null || value === undefined || value === "";
    })
    .map(([, label]) => label);

  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Volunteer" },
    select: { governmentIDID: true },
  });
  if (!governmentId) {
    missingLabels.push("Government ID");
  }

  // 409, same as /vets/me and /staff/me onboarding-complete, so the shared
  // wizard handles every role identically.
  if (missingLabels.length > 0) {
    const err = new Error(
      `Onboarding is incomplete — missing: ${missingLabels.join(", ")}`,
    );
    err.code = "CONFLICT";
    throw err;
  }

  return toSelfProfile(
    await prisma.volunteer.update({
      where: { userID },
      data: { onboardingComplete: true, onboardingStep: LAST_ONBOARDING_STEP },
      select: VOLUNTEER_SELF_SELECT,
    }),
  );
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateMyAvailability,
  advanceOnboardingStep,
  completeOnboarding,
};
