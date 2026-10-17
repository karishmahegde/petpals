// What it does: Defines the API routes
const express = require("express");
const authController = require("../../controllers/auth/auth.controller");
const authenticate = require("../../middleware/authenticate");

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *               role:
 *                 type: string
 *                 enum: [admin, adopter, staff, vet, volunteer, donor]
 *                 example: adopter
 *               shelterID:
 *                 type: integer
 *                 description: Required when role is volunteer or staff — an Open shelter whose staff (volunteer) or manager (staff) will approve the account
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Missing or invalid fields
 *       409:
 *         description: Email already registered
 */
router.post("/register", authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: >
 *           Login successful — returns access token in body, refresh token
 *           as httpOnly cookie. user carries onboardingComplete and
 *           onboardingStep for Adopter, Staff and Veterinarian, plus
 *           accountStatus for Staff and Veterinarian. A Pending Staff member
 *           or Veterinarian CAN log in (to onboard before approval) but can
 *           only reach their own onboarding endpoints until approved;
 *           Pending accounts of other roles get 401.
 *       401:
 *         description: >
 *           Incorrect password, or a Deactivated/Closed/Declined/Banned
 *           account (or Pending, for roles other than Staff/Veterinarian/
 *           Volunteer). A Closed account (closed by its owner) carries
 *           error.details.reason = "account_closed" so the login page can
 *           offer a reactivation link; a Declined one "account_declined".
 *       404:
 *         description: No account found with this email
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully — refresh token cookie cleared
 *       401:
 *         description: Missing, invalid, or already-invalidated token
 */
// allowPending: a Pending staff member or vet is logged in while they onboard
// (before approval), so they must be able to log out too.
router.post("/logout", authenticate.allowPending, authController.logout);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Issue a new access token using the refresh token cookie
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully — new access token in body, new refresh token cookie set. user has the same onboarding/accountStatus/emailVerified fields as login.
 *       401:
 *         description: Refresh token missing, invalid, or session expired
 */
router.post("/refresh-token", authController.refreshToken);

/**
 * @swagger
 * /auth/email-verification:
 *   post:
 *     summary: Email the signed-in user a new verification link
 *     description: >
 *       Registration already sends one; this is the resend. Each new link
 *       replaces the previous unused one and expires in 24 hours. Only
 *       applying to adopt and donating require a verified email.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent (data is null)
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409:
 *         description: Already verified — error.details.reason = "already_verified"
 *       429:
 *         description: >
 *           Asked again within 60 seconds of the last link —
 *           error.details.retryAfterSeconds says how long to wait
 *   patch:
 *     summary: Verify an email address with the token from the emailed link
 *     description: No session needed — the link may be opened on another device. Each link works once.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Verified — data is { emailVerified: true }
 *       400:
 *         description: >
 *           Link invalid, expired or already used — error.details.reason is
 *           token_invalid, token_expired or token_used
 */
// allowPending: a Pending staff member, vet or volunteer can verify while
// they onboard, before approval.
router.post(
  "/email-verification",
  authenticate.allowPending,
  authController.requestEmailVerification,
);
router.patch("/email-verification", authController.verifyEmail);

module.exports = router;
