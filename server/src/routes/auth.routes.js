const express = require("express");
const authController = require("../controllers/auth.controller");
const authenticate = require("../middleware/authenticate");

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
 *         description: Login successful — returns access token in body, refresh token as httpOnly cookie
 *       401:
 *         description: Incorrect password
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
router.post("/logout", authenticate, authController.logout);

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
 *         description: Token refreshed successfully — new access token in body, new refresh token cookie set
 *       401:
 *         description: Refresh token missing, invalid, or session expired
 */
router.post("/refresh-token", authenticate, authController.refreshToken);

module.exports = router;
