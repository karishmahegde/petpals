const prisma = require("../../config/prisma");
const { staffStatusDates } = require("../../utils/staffDates");
const storage = require("../storage");
const { nullifyRefreshToken } = require("../auth/auth.service");
const { ADDRESS_SELECT } = require("../../utils/address");

// Self-service shape — everything a staff member may see about their own
// row. Same field set as admin/staff.service.js's STAFF_LIST_SELECT (email
// via the `user` relation only, so userPassword/refreshToken can't leak),
// kept as a separate file/module since self-service and admin oversight are
// two different access patterns, mirroring adopters.service.js vs.
// admin/adopters.service.js.
const STAFF_SELF_SELECT = {
  userID: true,
  avatarSeed: true,
  staffName: true,
  staffPhone: true,
  shelterID: true,
  staffDOB: true,
  staffSex: true,
  staffDOJ: true,
  staffDOS: true,
  staffDesignation: true,
  accountStatus: true,
  onboardingComplete: true,
  onboardingStep: true,
  ...ADDRESS_SELECT,
  shelter: { select: { shelterName: true } },
  // emailVerified/lastLoginAt live on Users — flattened by toSelfProfile.
  user: { select: { userEmail: true, emailVerified: true, lastLoginAt: true } },
};

const notFound = () => {
  const err = new Error("No staff record exists for this account");
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET /staff/me ———————————————
// user.userEmail stays nested (same as the admin staff list shape);
// emailVerified/lastLoginAt are lifted to the top level.
const toSelfProfile = ({ user, ...rest }) => ({
  ...rest,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  user: { userEmail: user.userEmail },
});

const getMyProfile = async (userID) => {
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: STAFF_SELF_SELECT,
  });
  if (!staff) {
    throw notFound();
  }
  return toSelfProfile(staff);
};

// ——————————————— PUT /staff/me ———————————————
// `data` is already validated and whitelisted by the controller — only
// avatarSeed/staffName/staffPhone/staffDOB/staffSex and the address
// fields, never
// shelterID/staffDesignation/accountStatus (those are Admin-controlled, via
// PATCH /staff/:id and PATCH /staff/:id/status).
const updateMyProfile = async (userID, data) => {
  try {
    return toSelfProfile(
      await prisma.staff.update({
        where: { userID },
        data,
        select: STAFF_SELF_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound();
    }
    throw err;
  }
};

// ——————————————— ONBOARDING (PATCH /staff/me/onboarding-step, /onboarding-complete) ———————————————
// A new staff member onboards while still Pending, before approval (see
// authenticate.allowPending): Step 2 Personal, 3 Address, 4 Identity,
// 5 Review. Mirrors adopters.service.js's pair of endpoints.
const LAST_ONBOARDING_STEP = 5;

// `step` is the wizard step just completed (validated 2-5 by the
// controller). onboardingStep only ever advances, whatever the client sends.
const advanceOnboardingStep = async (userID, step) => {
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { onboardingStep: true },
  });
  if (!staff) {
    throw notFound();
  }

  const nextStep = Math.min(
    Math.max(staff.onboardingStep, step + 1),
    LAST_ONBOARDING_STEP,
  );
  return toSelfProfile(
    await prisma.staff.update({
      where: { userID },
      data: { onboardingStep: nextStep },
      select: STAFF_SELF_SELECT,
    }),
  );
};

// Checked server-side rather than trusting the wizard's own required-field
// checks, since this endpoint could be called directly. A submitted
// government ID is required too; it's Verified later by the approver, before
// they can approve (staffApproval.service.js).
const REQUIRED_FOR_COMPLETION = {
  staffPhone: "Phone",
  staffDOB: "Date of birth",
  staffSex: "Sex",
  addressLine1: "Address line 1",
  city: "City",
  state: "State",
  zip: "ZIP",
  country: "Country",
};

const completeOnboarding = async (userID) => {
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: Object.fromEntries(
      Object.keys(REQUIRED_FOR_COMPLETION).map((field) => [field, true]),
    ),
  });
  if (!staff) {
    throw notFound();
  }

  const missingLabels = Object.entries(REQUIRED_FOR_COMPLETION)
    .filter(([field]) => {
      const value = staff[field];
      return value === null || value === undefined || value === "";
    })
    .map(([, label]) => label);

  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Staff" },
    select: { governmentIDID: true },
  });
  if (!governmentId) {
    missingLabels.push("Government ID");
  }

  if (missingLabels.length > 0) {
    const err = new Error(
      `Onboarding is incomplete — missing: ${missingLabels.join(", ")}`,
    );
    err.code = "CONFLICT";
    throw err;
  }

  return toSelfProfile(
    await prisma.staff.update({
      where: { userID },
      data: { onboardingComplete: true, onboardingStep: LAST_ONBOARDING_STEP },
      select: STAFF_SELF_SELECT,
    }),
  );
};

// ——————————————— CLOSE MY ACCOUNT (DELETE /staff/me) ———————————————
// staffID is only ever set on AdoptionApplication together with becoming
// Accepted (see the PATCH /adoption-applications/:id/status staff
// transition) — never while still Pending under the workflow built so far.
// This guard is written literally against "a Pending application assigned
// to them" per spec anyway: it's a no-op today but stays correct (and
// non-bypassable) the moment a future "claim/assign to self" step exists.
const pendingApplicationConflict = () => {
  const err = new Error(
    "Reassign or resolve your Pending application(s) before closing your account",
  );
  err.code = "CONFLICT";
  return err;
};

const hasAssignedPendingApplication = async (userID) => {
  const application = await prisma.adoptionApplication.findFirst({
    where: { staffID: userID, applicationStatus: "Pending" },
    select: { applicationID: true },
  });
  return Boolean(application);
};

// 'deactivate' keeps the row (accountStatus → Deactivated, refresh token
// cleared); 'delete' permanently removes the Staff and Users rows. Both
// modes clear managerStaffID on every shelter this staff member currently
// manages — required for 'delete' (Shelter.managerStaffID FKs Staff.userID,
// so the row can't be removed while still referenced) and a deliberate
// business-rule choice for 'deactivate' too (mirrors updateStaffStatus in
// admin/staff.service.js — a deactivated account shouldn't stay a shelter's
// manager-of-record).
const closeMyAccount = async (userID, mode) => {
  if (await hasAssignedPendingApplication(userID)) {
    throw pendingApplicationConflict();
  }

  const clearManagedShelters = prisma.shelter.updateMany({
    where: { managerStaffID: userID },
    data: { managerStaffID: null },
  });

  if (mode === "deactivate") {
    const current = await prisma.staff.findUnique({
      where: { userID },
      select: { staffDOJ: true },
    });
    await prisma.$transaction([
      prisma.staff.update({
        where: { userID },
        // Stamps staffDOS — see utils/staffDates.js.
        data: {
          accountStatus: "Deactivated",
          ...staffStatusDates("Deactivated", current ?? {}),
        },
      }),
      clearManagedShelters,
      nullifyRefreshToken(prisma, userID),
    ]);
    return;
  }

  // Capture the government ID's stored file path (if any) before the
  // transaction — a network call has no place inside a DB transaction, same
  // pattern as adopters.service.js's closeAccount.
  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Staff" },
    select: { documentURL: true },
  });

  await prisma.$transaction([
    clearManagedShelters,
    prisma.governmentID.deleteMany({ where: { userID, userType: "Staff" } }),
    prisma.staff.delete({ where: { userID } }),
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
  advanceOnboardingStep,
  completeOnboarding,
  closeMyAccount,
};
