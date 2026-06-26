const jwt = require("jsonwebtoken");
const authService = require("../services/auth.service");
const { successResponse } = require("../utils/response");

const VALID_ROLES = ["admin", "adopter", "staff", "vet", "volunteer", "donor"];

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

const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const err = new Error("email and password are required");
    err.code = "VALIDATION_ERROR";
    return next(err);
  }

  try {
    const user = await authService.login({ email, password });
    const token = jwt.sign(
      { userID: user.userID, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    return successResponse(res, "Login successful", { token, user });
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, login };
