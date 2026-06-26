const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

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

// ——————————————— REGISTER ———————————————
const register = async ({ name, email, password, role }) => {
  const { roleEnum, model, nameField } = ROLE_CONFIG[role];

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

    await tx[model].create({
      data: {
        userID: user.userID,
        [nameField]: name,
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

  const { userPassword, refreshToken, ...safeUser } = user;
  return safeUser;
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

  const { refreshToken: _, ...safeUser } = user; // Strip the token to send back the response
  return safeUser;
};

module.exports = { register, login, storeRefreshToken, logout, refreshToken };
