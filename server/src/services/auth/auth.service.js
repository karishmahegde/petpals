const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = require("../../config/prisma");

// Maps the incoming role string to the Prisma enum value, model accessor, and name field
const ROLE_CONFIG = {
  admin: { roleEnum: "Admin", model: "admin", nameField: "adminName" },
  adopter: { roleEnum: "Adopter", model: "adopter", nameField: "adopterName" },
  staff: { roleEnum: "Staff", model: "staff", nameField: "staffName" },
  vet: {
    roleEnum: "Veterinarian",
    model: "veterinarian",
    nameField: "vetName",
  },
  volunteer: {
    roleEnum: "Volunteer",
    model: "volunteer",
    nameField: "volunteerName",
  },
  donor: { roleEnum: "Donor", model: "donor", nameField: "donorName" },
};

// Roles whose table gates login behind admin/staff approval — self-registered
// rows start Pending. Deliberately NOT relying on each table's DB-level
// column default here (even though schema.prisma declares one to match):
// this project hand-applies schema changes as raw SQL rather than Prisma
// migrations (see manual-constraints.sql), and setting a column's default to
// an enum value it just gained requires a separate transaction from the
// ALTER TYPE that added it — so a freshly-set-up DB may still be mid-way
// through that two-step SQL. Setting accountStatus explicitly here means
// registration behaves correctly regardless.
// Volunteer is approved by staff at the shelter picked at registration.
const PENDING_GATED_ROLES = new Set(["admin", "staff", "vet", "volunteer"]);

// ——————————————— REGISTER ———————————————
const register = async ({ name, email, password, role, shelterID }) => {
  const { roleEnum, model, nameField } = ROLE_CONFIG[role];

  // Volunteers apply to one shelter, whose staff approve them — must be a
  // shelter the public /shelters list offers (Open).
  if (role === "volunteer") {
    const shelter = await prisma.shelter.findUnique({
      where: { shelterID },
      select: { shelterStatus: true },
    });
    if (shelter?.shelterStatus !== "Open") {
      const err = new Error("shelterID must reference an open shelter");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
  }

  //Check if email already exists
  const existing = await prisma.users.findUnique({
    where: { userEmail: email },
  });
  if (existing) {
    const err = new Error("A user with this email is already registered");
    err.code = "CONFLICT";
    throw err;
  }

  //Hashing the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Both inserts run atomically — if the role-table insert fails, the Users row is rolled back
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        userEmail: email,
        userPassword: hashedPassword,
        role: roleEnum,
      },
    });

    let accountStatus;
    if (PENDING_GATED_ROLES.has(role)) {
      // Bootstrap: the very first Admin ever created has no one to approve
      // them, so they auto-activate. Every Admin after that — and every
      // Staff/Vet/Volunteer — starts Pending.
      const isFirstAdmin =
        role === "admin" && (await tx.admin.count()) === 0;
      accountStatus = isFirstAdmin ? "Active" : "Pending";
    }

    await tx[model].create({
      data: {
        userID: user.userID,
        [nameField]: name,
        avatarSeed: crypto.randomUUID(),
        ...(accountStatus ? { accountStatus } : {}),
        ...(role === "volunteer" ? { shelterID } : {}),
      },
    });

    return user;
  });

  const { userPassword, ...safeUser } = newUser;
  return safeUser;
};

// ——————————————— LOGIN ———————————————
const login = async ({ email, password }) => {
  const user = await prisma.users.findUnique({
    where: { userEmail: email },
    select: { userID: true, userEmail: true, role: true, userPassword: true },
  }); //Fetches the row from USERS - Email, password, role and refreshToken
  if (!user) {
    const err = new Error("No account found with this email");
    err.code = "NOT_FOUND";
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.userPassword);
  if (!passwordMatch) {
    const err = new Error("Incorrect password");
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const config = Object.values(ROLE_CONFIG).find((c) => c.roleEnum === user.role);
  const isAdopter = user.role === "Adopter";
  let name = null;
  let avatarSeed = null;
  let onboardingComplete;
  let onboardingStep;
  if (config) {
    // Every role table now carries its own accountStatus field (Active/
    // Deactivated for Admin/Staff/Vet; Active/Banned/Deactivated for Adopter/
    // Donor; Pending/Active/Banned/Deactivated for Volunteer, which also
    // gates on staff approval). Fetching it unconditionally lets the block
    // below stay role-agnostic — "Banned" or "Pending" simply never occurs
    // for a role whose enum doesn't define it.
    const roleRecord = await prisma[config.model].findUnique({
      where: { userID: user.userID },
      select: {
        [config.nameField]: true,
        accountStatus: true,
        avatarSeed: true,
        ...(isAdopter ? { onboardingComplete: true, onboardingStep: true } : {}),
      },
    });
    name = roleRecord?.[config.nameField] ?? null;
    avatarSeed = roleRecord?.avatarSeed ?? null;
    if (isAdopter) {
      onboardingComplete = roleRecord?.onboardingComplete ?? false;
      onboardingStep = roleRecord?.onboardingStep ?? 2;
    }

    // Blocked account states — checked here (not in a request middleware) since
    // this is the only point a fresh login can be refused; an already-issued
    // access token is short-lived (15m) and expires on its own regardless.
    // 401, not 403: the frontend's axios interceptor hard-redirects to
    // /forbidden on any 403 with no exemption for auth calls, which would hide
    // this message from the user on the login page.
    if (roleRecord?.accountStatus === "Deactivated") {
      // Only Adopter has a self-service closure flow today — the message says
      // so where it's true, and stays neutral for roles an admin deactivates.
      const message =
        user.role === "Adopter"
          ? "This account was deactivated by its owner. Contact support to reactivate it."
          : "This account has been deactivated. Contact support if you believe this is an error.";
      const err = new Error(message);
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (roleRecord?.accountStatus === "Banned") {
      const err = new Error("This account has been banned.");
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (roleRecord?.accountStatus === "Pending") {
      // Staff/Vet are approved by an Admin/Staff member; a self-registered
      // Volunteer is approved by staff. Generic wording since "pending staff
      // approval" was only ever true for two of the four Pending-capable roles.
      const err = new Error(
        "This account is pending approval and can't log in yet.",
      );
      err.code = "UNAUTHORIZED";
      throw err;
    }
  }

  // Runs after every blocking check above, so a rejected login (wrong
  // password, Banned/Deactivated/Pending account) never counts as one.
  // Adopter and Admin track lastLoginAt; other roles don't have the column
  // yet.
  if (user.role === "Adopter") {
    await prisma.adopter.update({
      where: { userID: user.userID },
      data: { lastLoginAt: new Date() },
    });
  } else if (user.role === "Admin") {
    await prisma.admin.update({
      where: { userID: user.userID },
      data: { lastLoginAt: new Date() },
    });
  }

  const { userPassword, refreshToken, ...safeUser } = user;
  return {
    ...safeUser,
    name,
    avatarSeed,
    ...(isAdopter ? { onboardingComplete, onboardingStep } : {}),
  };
};

// ——————————————— ACCOUNT STATUS LOOKUP (used by authenticate.js) ———————————————
// A JWT access token stays valid for its full 15-minute life regardless of
// what happens to the account after it was issued — login() above only
// blocks a *fresh* login. This closes that gap: authenticate() calls this on
// every protected request so a just-deactivated/deleted account's token
// stops working immediately instead of waiting out its natural expiry.
// Returns null for a role with no accountStatus-bearing table (there are
// none today — all six roles have one) or "DELETED" as a sentinel if the
// role row itself no longer exists (a completed self-delete).
const getAccountStatus = async (userID, role) => {
  const config = Object.values(ROLE_CONFIG).find((c) => c.roleEnum === role);
  if (!config) return null;
  const record = await prisma[config.model].findUnique({
    where: { userID },
    select: { accountStatus: true },
  });
  return record ? record.accountStatus : "DELETED";
};

const storeRefreshToken = async (userID, hashedRefreshToken) => {
  //Once user is autheticaated, controller creates the refreshToken and hashes it. This is stored in the User table
  await prisma.users.update({
    where: { userID },
    data: { refreshToken: hashedRefreshToken },
  });
};

// ——————————————— LOGOUT ———————————————
const logout = async (userID) => {
  //The refreshToken field in Users table is cleared
  await prisma.users.update({
    where: { userID },
    data: { refreshToken: null },
  });
};

// ——————————————— ACCOUNT CLOSURE (shared across roles) ———————————————
// The 'deactivate' vs 'delete' guard and cascade logic is genuinely different
// per role (an Adopter's favorites/visits/applications don't exist for
// Staff/Donor/Vet/Volunteer), so each role keeps its own closeAccount()
// service (e.g. adopters.service.js). This is just the shared tail end —
// mode validation, the response message, and forcing logout — reused by
// every role's flow instead of being copy-pasted six times.
const CLOSE_ACCOUNT_MODES = ["deactivate", "delete"];

const assertValidCloseAccountMode = (mode) => {
  if (!CLOSE_ACCOUNT_MODES.includes(mode)) {
    const err = new Error("mode must be 'deactivate' or 'delete'");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
};

// Nulls the refresh token as part of a role's own closeAccount() transaction —
// pass either the plain prisma client (array-form $transaction) or a tx
// client (interactive $transaction), since both expose the same delegate
// shape. Only needed for 'deactivate' — 'delete' removes the Users row
// itself, which already takes the refresh token with it.
const nullifyRefreshToken = (client, userID) =>
  client.users.update({ where: { userID }, data: { refreshToken: null } });

const closeAccountMessage = (mode) =>
  mode === "delete" ? "Account deleted" : "Account deactivated";

// ——————————————— REFRESH TOKEN ———————————————
const refreshToken = async (userID, rawOldRT, rawNewRT) => {
  const user = await prisma.users.findUnique({
    //Fetch the userID, role and current refreshToken value from DB
    where: { userID },
    select: { userID: true, role: true, refreshToken: true },
  });
  if (!user) {
    const err = new Error("User not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (!user.refreshToken) {
    // No refreshToken in the DB, which means user is logged out
    const err = new Error("Session expired, please log in again");
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const match = await bcrypt.compare(rawOldRT, user.refreshToken); // Check if old refreshToken from the request and the refreshToken in DB match, which authenticates the request
  if (!match) {
    const err = new Error("Invalid refresh token");
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const newHash = await bcrypt.hash(rawNewRT, 10); // Hash the new refreshToken and store in the DB
  await prisma.users.update({
    where: { userID },
    data: { refreshToken: newHash },
  });

  const config = Object.values(ROLE_CONFIG).find((c) => c.roleEnum === user.role);
  const isAdopter = user.role === "Adopter";
  let name = null;
  let avatarSeed = null;
  let onboardingComplete;
  let onboardingStep;
  if (config) {
    const roleRecord = await prisma[config.model].findUnique({
      where: { userID: user.userID },
      select: {
        [config.nameField]: true,
        avatarSeed: true,
        ...(isAdopter ? { onboardingComplete: true, onboardingStep: true } : {}),
      },
    });
    name = roleRecord?.[config.nameField] ?? null;
    avatarSeed = roleRecord?.avatarSeed ?? null;
    if (isAdopter) {
      onboardingComplete = roleRecord?.onboardingComplete ?? false;
      onboardingStep = roleRecord?.onboardingStep ?? 2;
    }
  }

  const { refreshToken: _, ...safeUser } = user; // Strip the token to send back the response
  return {
    ...safeUser,
    name,
    avatarSeed,
    ...(isAdopter ? { onboardingComplete, onboardingStep } : {}),
  };
};

module.exports = {
  register,
  login,
  getAccountStatus,
  storeRefreshToken,
  logout,
  refreshToken,
  assertValidCloseAccountMode,
  nullifyRefreshToken,
  closeAccountMessage,
};
