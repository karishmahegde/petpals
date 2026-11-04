const jwt = require("jsonwebtoken");
const authService = require("../../services/auth/auth.service");
const emailVerificationService = require("../../services/auth/emailVerification.service");
const passwordsService = require("../../services/auth/passwords.service");
const reactivationService = require("../../services/auth/reactivation.service");
const emailChangeService = require("../../services/auth/emailChange.service");
const { unmetPasswordRules } = require("../../utils/password");
const { successResponse } = require("../../utils/response");

const VALID_ROLES = ["admin", "adopter", "staff", "vet", "volunteer", "donor"];

// The refresh token and its cookie share one lifetime. Without maxAge the
// cookie was a session cookie, which browsers (iOS Safari especially) drop
// when the tab or app closes — the 7-day sign-in never survived. Every
// refresh re-sets it, so the 7 days count from the last visit.
const REFRESH_TOKEN_DAYS = 7;
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production", // Cookie is sent securely only in HTTPS
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
};

// Signs a new 7-day refresh token, stores its hash (replacing any other
// session's) and sets it as the httpOnly cookie. Used by login and by a
// password change, which keeps the current session while signing out others.
const startRefreshSession = async (res, userID) => {
  const refreshToken = jwt.sign({ userID }, process.env.JWT_SECRET, {
    expiresIn: `${REFRESH_TOKEN_DAYS}d`,
  });
  await authService.storeRefreshToken(userID, refreshToken); // Store the refreshToken's hash against the user's record in the user table
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS); // return the refreshToken in an httpOnly cookie
};

// ——————————————— REGISTER ———————————————
const register = async (req, res, next) => {
  const { name, email, password, role } = req.body; // Destructures { name, email, password, role } from req.body

  // Returns VALIDATION_ERROR via next(err) if any of the four fields are missing, or if role isn't one of the 6 valid values
  if (!name || !email || !password || !role) {
    const err = new Error("name, email, password, and role are required");
    err.code = "VALIDATION_ERROR";
    return next(err);
  }

  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`role must be one of: ${VALID_ROLES.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    return next(err);
  }

  // Same strength rules as a reset or change (utils/password.js) — the
  // register forms check them too, so this only catches direct API calls.
  const unmet = unmetPasswordRules(password);
  if (unmet.length > 0) {
    const err = new Error(`password needs ${unmet.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.details = { unmet };
    return next(err);
  }

  // Volunteers, staff, and vets must pick the shelter they're joining (its
  // staff / manager approve them)
  let shelterID;
  if (role === "volunteer" || role === "staff" || role === "vet") {
    shelterID = Number(req.body.shelterID);
    if (!Number.isInteger(shelterID) || shelterID < 1) {
      const err = new Error(
        `shelterID is required for ${role} accounts and must be a positive integer`,
      );
      err.code = "VALIDATION_ERROR";
      return next(err);
    }
  }

  // Wraps the service call in try/catch — success → successResponse with 201, failure → next(err) to the global error handler
  try {
    const user = await authService.register({ name, email, password, role, shelterID });
    return successResponse(res, "User registered successfully", user, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— LOGIN ———————————————
const login = async (req, res, next) => {
  const { email, password } = req.body;

  // Returns VALIDATION_ERROR via next(err) if email or password fields are missing
  if (!email || !password) {
    const err = new Error("email and password are required");
    err.code = "VALIDATION_ERROR";
    return next(err);
  }

  try {
    const user = await authService.login({ email, password }); // Validates if user email and password is correct. If successful, returns the email, userID and role.
    const accessToken = jwt.sign(
      //Use the userID + role to create the JWT token
      { userID: user.userID, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    await startRefreshSession(res, user.userID);
    return successResponse(res, "Login successful", {
      token: accessToken,
      user,
    });
  } catch (err) {
    return next(err);
  }
};

// ——————————————— LOGOUT ———————————————
const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.userID); // Update Users table to clear the refreshToken value from the record
    res.clearCookie("refreshToken"); // Clears the refreshToken httpOnly cookie from the browser
    return successResponse(res, "Logged out successfully", null);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— REFRESH TOKEN ———————————————
const refreshToken = async (req, res, next) => {
  const rawOldRT = req.cookies.refreshToken;
  if (!rawOldRT) {
    const err = new Error("No refresh token provided");
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  const decoded = jwt.decode(rawOldRT);
  if (!decoded?.userID) {
    const err = new Error("Invalid refresh token");
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  const newRefreshToken = jwt.sign(
    //Create new refreshToken
    { userID: decoded.userID },
    process.env.JWT_SECRET,
    { expiresIn: `${REFRESH_TOKEN_DAYS}d` },
  );

  try {
    const user = await authService.refreshToken(
      // Replace old refreshToken with new refreshToken in the Users table
      decoded.userID,
      rawOldRT,
      newRefreshToken,
    );
    const newAccessToken = jwt.sign(
      // Create new accessToken
      { userID: user.userID, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS); // Append new refreshToken to the cookie
    return successResponse(res, "Token refreshed successfully", {
      //return the 2 new tokens and the userID and role back
      token: newAccessToken,
      user: {
        userID: user.userID,
        role: user.role,
        name: user.name,
        avatarSeed: user.avatarSeed,
        onboardingComplete: user.onboardingComplete,
        onboardingStep: user.onboardingStep,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ——————————————— EMAIL VERIFICATION ———————————————
// POST: (re)send a link to the signed-in user. PATCH: { token } from the link.
const requestEmailVerification = async (req, res, next) => {
  try {
    await emailVerificationService.requestVerification(req.user.userID);
    return successResponse(res, "Verification email sent", null);
  } catch (err) {
    return next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const data = await emailVerificationService.verifyEmail(req.body?.token);
    return successResponse(res, "Email address verified", data);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PASSWORD RESET + CHANGE ———————————————
// POST: { email } — same 200 whether or not the account exists.
const requestPasswordReset = async (req, res, next) => {
  try {
    await passwordsService.requestPasswordReset(req.body?.email);
    return successResponse(
      res,
      "If an account exists for that email, a password reset link is on its way",
      null,
    );
  } catch (err) {
    return next(err);
  }
};

// PATCH: { token, password } from the emailed link. Signs out every session.
const resetPassword = async (req, res, next) => {
  try {
    const data = await passwordsService.resetPassword(req.body?.token, req.body?.password);
    res.clearCookie("refreshToken");
    return successResponse(res, "Password reset — please log in with your new password", data);
  } catch (err) {
    return next(err);
  }
};

// PATCH /auth/password: { currentPassword, newPassword }. This session stays
// signed in (fresh refresh token + cookie); any other is signed out.
const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body ?? {};
  try {
    await passwordsService.changePassword(req.user.userID, currentPassword, newPassword);
    await startRefreshSession(res, req.user.userID);
    return successResponse(res, "Password changed", null);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— REACTIVATION ———————————————
// POST: { email } — same 200 whether or not there's a Closed account.
const requestReactivation = async (req, res, next) => {
  try {
    await reactivationService.requestReactivation(req.body?.email);
    return successResponse(
      res,
      "If that email belongs to a closed account, a reactivation link is on its way",
      null,
    );
  } catch (err) {
    return next(err);
  }
};

// PATCH: { token } from the emailed link.
const reactivate = async (req, res, next) => {
  try {
    const data = await reactivationService.reactivate(req.body?.token);
    return successResponse(res, "Account reactivated", data);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— EMAIL CHANGE ———————————————
// POST: { newEmail, currentPassword } — signed in. PATCH: { token } from the
// link sent to the new address.
const requestEmailChange = async (req, res, next) => {
  const { newEmail, currentPassword } = req.body ?? {};
  try {
    await emailChangeService.requestEmailChange(req.user.userID, newEmail, currentPassword);
    return successResponse(res, "Confirmation link sent to the new email address", null);
  } catch (err) {
    return next(err);
  }
};

const confirmEmailChange = async (req, res, next) => {
  try {
    const data = await emailChangeService.confirmEmailChange(req.body?.token);
    return successResponse(res, "Email address changed", data);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  requestEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  requestReactivation,
  reactivate,
  requestEmailChange,
  confirmEmailChange,
};
