const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authService = require("../services/auth.service");
const { successResponse } = require("../utils/response");

const VALID_ROLES = ["admin", "adopter", "staff", "vet", "volunteer", "donor"];

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

  // Wraps the service call in try/catch — success → successResponse with 201, failure → next(err) to the global error handler
  try {
    const user = await authService.register({ name, email, password, role });
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
    const refreshToken = jwt.sign(
      { userID: user.userID },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    const hashedRT = await bcrypt.hash(refreshToken, 10);
    await authService.storeRefreshToken(user.userID, hashedRT); // Store the refreshToken against the user's record in the user table
    res.cookie("refreshToken", refreshToken, {
      //return the refreshToken in an httpOnly cookie
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production", // Cookie is sent securely only in HTTPS
    });
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
  const rawOldRT = req.cookies.refreshToken; // Extract refreshToken
  if (!rawOldRT) {
    const err = new Error("No refresh token provided");
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  const token = req.headers.authorization.split(" ")[1]; // Extract accessToken
  const decoded = jwt.decode(token);

  const newRefreshToken = jwt.sign(
    //Create new refreshToken
    { userID: decoded.userID },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
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
    res.cookie("refreshToken", newRefreshToken, {
      // Append new refreshToken to the cookie
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    return successResponse(res, "Token refreshed successfully", {
      //return the 2 new tokens and the userID and role back
      token: newAccessToken,
      user: { userID: user.userID, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, login, logout, refreshToken };
