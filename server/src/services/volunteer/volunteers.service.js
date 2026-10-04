const prisma = require("../../config/prisma");
const storage = require("../storage");
const { nullifyRefreshToken } = require("../auth/auth.service");
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

// ——————————————— CLOSE MY ACCOUNT (DELETE /volunteers/me) ———————————————
// Mirrors vet/vets.service.js's closeMyAccount. Blocked in either mode while
// the volunteer still has work staff are counting on — an upcoming
// Scheduled appointment they're assisting, or an In_progress task — so
// staff reassign it first rather than finding out on the day.
// `details.blockers` names each reason in a fixed form ("appointments",
// "tasks") so the client can link to the right tab without parsing the
// message.
const openWorkConflict = (reasons) => {
  const err = new Error(
    `You have ${reasons.map((r) => r.label).join(" and ")} — ask your shelter's staff to reassign them before closing your account`,
  );
  err.code = "CONFLICT";
  err.details = { blockers: reasons.map((r) => r.key) };
  return err;
};

// 'deactivate' keeps the row (accountStatus → Deactivated, refresh token
// cleared). 'delete' removes the Volunteer and Users rows (the refresh token
// goes with Users) plus their government ID and its stored file.
//
// Either way, the volunteer comes off events that haven't happened yet —
// staff assign volunteers to events, and shouldn't be left expecting someone
// whose account is closed. Past assignments stay as history on deactivate;
// delete has to remove every VolunteerTask/VolunteerEvent row (both FKs to
// Volunteer are RESTRICT), so the tasks and events themselves stay and just
// lose this volunteer. Appointment.volunteerID and
// VolunteerApplication.volunteerID are ON DELETE SET NULL — that history
// survives with no volunteer attached.
const closeMyAccount = async (userID, mode) => {
  const now = new Date();
  const [upcomingAppointment, openTask] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        volunteerID: userID,
        appointmentStatus: "Scheduled",
        appointmentDate: { gt: now },
      },
      select: { appointmentID: true },
    }),
    prisma.task.findFirst({
      where: {
        taskStatus: "In_progress",
        volunteers: { some: { volunteerID: userID } },
      },
      select: { taskID: true },
    }),
  ]);
  const reasons = [
    ...(upcomingAppointment ? [{ key: "appointments", label: "upcoming appointments" }] : []),
    ...(openTask ? [{ key: "tasks", label: "open tasks" }] : []),
  ];
  if (reasons.length > 0) {
    throw openWorkConflict(reasons);
  }

  if (mode === "deactivate") {
    await prisma.$transaction([
      prisma.volunteerEvent.deleteMany({
        where: { volunteerID: userID, event: { eventDate: { gt: now } } },
      }),
      prisma.volunteer.update({
        where: { userID },
        data: { accountStatus: "Deactivated" },
      }),
      nullifyRefreshToken(prisma, userID),
    ]);
    return;
  }

  // Capture the government ID's stored file path before the transaction — a
  // network call has no place inside a DB transaction (same as vets').
  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Volunteer" },
    select: { documentURL: true },
  });

  await prisma.$transaction([
    prisma.volunteerEvent.deleteMany({ where: { volunteerID: userID } }),
    prisma.volunteerTask.deleteMany({ where: { volunteerID: userID } }),
    prisma.governmentID.deleteMany({ where: { userID, userType: "Volunteer" } }),
    prisma.volunteer.delete({ where: { userID } }),
    prisma.users.delete({ where: { userID } }),
  ]);

  if (governmentId?.documentURL) {
    await storage.deletePrivateFile(
      storage.GOVERNMENT_IDS_BUCKET,
      governmentId.documentURL,
    );
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateMyAvailability,
  advanceOnboardingStep,
  completeOnboarding,
  closeMyAccount,
};
