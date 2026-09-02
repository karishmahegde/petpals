// What it does: Defines the /adopters routes — mounted at /api/v1/adopters in app.js
const express = require("express");
const adoptersController = require("../controllers/adopters.controller");
const authenticate = require("../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /adopters/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in adopter
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Adopter profile, including housing, household, lifestyle, and preference fields. Sensitive fields (stripeCustomerID) are never included.
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: No adopter record exists for the current user
 */
router.get("/me", authenticate, authorizeRoles(ROLES.ADOPTER), adoptersController.getMe);

module.exports = router;
