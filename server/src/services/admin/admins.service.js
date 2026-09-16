const prisma = require("../../config/prisma");
const { nullifyRefreshToken } = require("../auth/auth.service");
const storage = require("../storage");

// Admin has no designation/shelter to manage — just identity + account
// status. Email comes from the `user` relation only, so userPassword/
// refreshToken can't leak here even by accident. statusChangedBy is a
// self-relation — only the changer's name/id, never their own email/phone —
// enough to show "last changed by X" without a second round trip.
const ADMIN_LIST_SELECT = {
  userID: true,
  avatarSeed: true,
  adminName: true,
  adminPhone: true,
  adminAddress: true,
  adminDOB: true,
  adminSex: true,
  createdAt: true,
  lastLoginAt: true,
  accountStatus: true,
  statusChangedAt: true,
  user: { select: { userEmail: true } },
  statusChangedBy: { select: { userID: true, adminName: true } },
};

// ——————————————— LIST ADMINS (GET /admins) ———————————————
const listAdmins = async ({ accountStatus, page = 1, limit = 20 } = {}) => {
  const where = {};
  if (accountStatus !== undefined) where.accountStatus = accountStatus;

  const [data, total] = await Promise.all([
    prisma.admin.findMany({
      where,
      select: ADMIN_LIST_SELECT,
      orderBy: { adminName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.admin.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const notFound = (userID) => {
  const err = new Error(`No admin exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET ADMIN DETAIL (GET /admins/:id) ———————————————
const getAdminDetail = async (userID) => {
  const admin = await prisma.admin.findUnique({
    where: { userID },
    select: ADMIN_LIST_SELECT,
  });
  if (!admin) {
    throw notFound(userID);
  }
  return admin;
};

// ——————————————— UPDATE STATUS (PATCH /admins/:id/status) ———————————————
// Same shape as Staff's: Active approves a Pending account (or reactivates
// one), Deactivated declines/deactivates. Login itself already rejects a
// Deactivated or Pending admin account (auth.service.js's role-agnostic
// accountStatus check). `actorID` is the acting admin's own userID — recorded
// as statusChangedByID/At, the last-change audit trail shown in
// AdminDetailPanel.
const updateAdminStatus = async (userID, accountStatus, actorID) => {
  try {
    await prisma.admin.update({
      where: { userID },
      data: {
        accountStatus,
        statusChangedByID: actorID,
        statusChangedAt: new Date(),
      },
    });
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(userID);
    }
    throw err;
  }

  return getAdminDetail(userID);
};

// ——————————————— UPDATE MY PROFILE (PUT /admins/me) ———————————————
// `data` is already validated and whitelisted by the controller — only
// avatarSeed and/or adminName, nothing account-status-related.
const updateMyProfile = async (userID, data) => {
  try {
    return await prisma.admin.update({
      where: { userID },
      data,
      select: ADMIN_LIST_SELECT,
    });
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(userID);
    }
    throw err;
  }
};

// ——————————————— CLOSE MY ACCOUNT (DELETE /admins/me) ———————————————
// No extra guard against closing the last active Admin — unlike
// updateAdminStatus (org-wide, someone else's account), this is a
// self-service action on your own account, same as every other role's
// close-account flow. 'deactivate' keeps the row; 'delete' removes it —
// Admin has no other relations besides an optional GovernmentID row (no
// favorites/visits/applications like Adopter).
const closeMyAccount = async (userID, mode) => {
  if (mode === "deactivate") {
    await prisma.$transaction([
      prisma.admin.update({
        where: { userID },
        data: {
          accountStatus: "Deactivated",
          // Self-service — the actor and the target are the same admin.
          statusChangedByID: userID,
          statusChangedAt: new Date(),
        },
      }),
      nullifyRefreshToken(prisma, userID),
    ]);
    return;
  }

  // Capture the government ID's stored file path (if any) before the
  // transaction — a network call has no place inside a DB transaction, same
  // pattern as adopters.service.js's closeAccount.
  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Admin" },
    select: { documentURL: true },
  });

  await prisma.$transaction([
    prisma.governmentID.deleteMany({ where: { userID, userType: "Admin" } }),
    prisma.admin.delete({ where: { userID } }),
    prisma.users.delete({ where: { userID } }),
  ]);

  if (governmentId?.documentURL) {
    await storage.deletePrivateFile(
      storage.GOVERNMENT_IDS_BUCKET,
      governmentId.documentURL,
    );
  }
};

// ——————————————— GOVERNMENT ID (GET/POST /admins/me/government-id) ———
// Mirrors adopters.service.js's createGovernmentId/getGovernmentId exactly,
// scoped to userType: "Admin" instead of "Adopter" — same table, same
// private bucket, same one-per-user constraint, same Rejected-can-resubmit
// exception. Self-only, same as Adopter's — never exposed to other admins
// via AdminDetailPanel.
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
    "A government ID has already been submitted for this admin",
  );
  err.code = "CONFLICT";
  return err;
};

const createGovernmentId = async (userID, { idType, idNumber, file }) => {
  const existing = await prisma.governmentID.findFirst({
    where: { userID, userType: "Admin" },
    select: { governmentIDID: true, verificationStatus: true, documentURL: true },
  });
  if (existing && existing.verificationStatus !== "Rejected") {
    throw alreadySubmitted();
  }

  const ext = EXT_BY_MIME[file.mimetype] || "bin";
  const objectPath = `admin/${userID}/id-${Date.now()}.${ext}`;

  await storage.uploadPrivateFile(
    storage.GOVERNMENT_IDS_BUCKET,
    objectPath,
    file.buffer,
    file.mimetype,
  );

  const record = existing
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
          userType: "Admin",
          idType,
          idNumber,
          documentURL: objectPath,
        },
        select: GOVERNMENT_ID_SELECT,
      });

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
};

const getGovernmentId = async (userID) => {
  const record = await prisma.governmentID.findFirst({
    where: { userID, userType: "Admin" },
    select: GOVERNMENT_ID_SELECT,
  });

  if (!record) {
    const err = new Error("No government ID has been submitted for this admin");
    err.code = "NOT_FOUND";
    // Expected on every load before an admin has submitted one — not a real
    // error, so it shouldn't spam a stack trace to the server console.
    err.quiet = true;
    throw err;
  }

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
};

module.exports = {
  listAdmins,
  getAdminDetail,
  updateAdminStatus,
  updateMyProfile,
  closeMyAccount,
  createGovernmentId,
  getGovernmentId,
};
