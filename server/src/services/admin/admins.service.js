const prisma = require("../../config/prisma");
const { nullifyRefreshToken } = require("../auth/auth.service");
const storage = require("../storage");
const { ADDRESS_SELECT } = require("../../utils/address");

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
  ...ADDRESS_SELECT,
  adminDOB: true,
  adminSex: true,
  createdAt: true,
  accountStatus: true,
  statusChangedAt: true,
  // emailVerified/lastLoginAt live on Users — flattened by toAdminShape.
  user: { select: { userEmail: true, emailVerified: true, lastLoginAt: true } },
  statusChangedBy: { select: { userID: true, adminName: true } },
};

// Keeps the response shape: user.userEmail nested as before, lastLoginAt at
// the top level (it used to be an Admin column).
const toAdminShape = ({ user, ...rest }) => ({
  ...rest,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  user: { userEmail: user.userEmail },
});

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
    data: data.map(toAdminShape),
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
  return toAdminShape(admin);
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
    return toAdminShape(
      await prisma.admin.update({
        where: { userID },
        data,
        select: ADMIN_LIST_SELECT,
      }),
    );
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

module.exports = {
  listAdmins,
  getAdminDetail,
  updateAdminStatus,
  updateMyProfile,
  closeMyAccount,
};
