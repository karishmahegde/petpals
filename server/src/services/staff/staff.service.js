const prisma = require("../../config/prisma");
const { staffStatusDates } = require("../../utils/staffDates");
const storage = require("../storage");
const { isUniqueViolation } = require("../../utils/prismaErrors");
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

// ——————————————— GOVERNMENT ID (GET/POST /staff/me/government-id) ———————
// Mirrors adopters.service.js's createGovernmentId/getGovernmentId (and
// admins.service.js's copy of the same) exactly, scoped to userType:
// "Staff" — same table, same private bucket, same one-per-user constraint,
// same Rejected-can-resubmit exception, same masked-idNumber shape on BOTH
// POST and GET (idNumber is masked, never returned in full, on either route
// — it is not omitted from GET; that would make this the only one of the
// three identical endpoints in the codebase to behave that way).
const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

const GOVERNMENT_ID_SELECT = {
  governmentIDID: true,
  userID: true,
  userType: true,
  idType: true,
  idNumber: true,
  verificationStatus: true,
  documentURL: true,
};

// Show only the last 4 characters of an ID number in responses.
const maskIdNumber = (idNumber) => {
  const tail = idNumber.slice(-4);
  return `${"*".repeat(Math.max(idNumber.length - tail.length, 0))}${tail}`;
};

const alreadySubmitted = () => {
  const err = new Error(
    "A government ID has already been submitted for this staff member",
  );
  err.code = "CONFLICT";
  return err;
};

const createGovernmentId = async (userID, { idType, idNumber, file }) => {
  // Fast path only — the real guarantee is the @@unique([userID, userType])
  // constraint, caught as a unique violation below. A Rejected record is the
  // one exception: the staff member can resubmit, which overwrites that same
  // row (and resets it to Pending) instead of blocking.
  const existing = await prisma.governmentID.findFirst({
    where: { userID, userType: "Staff" },
    select: { governmentIDID: true, verificationStatus: true, documentURL: true },
  });
  if (existing && existing.verificationStatus !== "Rejected") {
    throw alreadySubmitted();
  }

  const ext = EXT_BY_MIME[file.mimetype] || "bin";
  const objectPath = `staff/${userID}/id-${Date.now()}.${ext}`;

  await storage.uploadPrivateFile(
    storage.GOVERNMENT_IDS_BUCKET,
    objectPath,
    file.buffer,
    file.mimetype,
  );

  let record;
  try {
    record = existing
      ? await prisma.governmentID.update({
          where: { governmentIDID: existing.governmentIDID },
          data: {
            idType,
            idNumber,
            verificationStatus: "Pending",
            documentURL: objectPath,
          },
          select: GOVERNMENT_ID_SELECT,
        })
      : await prisma.governmentID.create({
          data: {
            userID,
            userType: "Staff",
            idType,
            idNumber,
            documentURL: objectPath,
          },
          select: GOVERNMENT_ID_SELECT,
        });
  } catch (err) {
    // DB write failed after the file landed — remove the orphaned object.
    await storage.deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, objectPath);
    // Lost a race with a concurrent submission — the unique constraint fired.
    if (isUniqueViolation(err)) {
      throw alreadySubmitted();
    }
    throw err;
  }

  // Resubmission replaced the stored file — the previous one is now
  // orphaned. Best-effort, same as the failure-path cleanup above.
  if (existing?.documentURL) {
    await storage.deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, existing.documentURL);
  }

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
};

const getGovernmentId = async (userID) => {
  const record = await prisma.governmentID.findFirst({
    where: { userID, userType: "Staff" },
    select: GOVERNMENT_ID_SELECT,
  });

  if (!record) {
    const err = new Error("No government ID has been submitted for this staff member");
    err.code = "NOT_FOUND";
    // Expected on every load before a staff member has submitted one — not a
    // real error, so it shouldn't spam a stack trace to the server console.
    err.quiet = true;
    throw err;
  }

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
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
  createGovernmentId,
  getGovernmentId,
  closeMyAccount,
};
