// Defines the /adoption-applications routes — mounted at /api/v1/adoption-applications in app.js
const express = require("express");
const controller = require("../controllers/adoptionApplications.controller");
const authenticate = require("../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /adoption-applications:
 *   post:
 *     summary: Submit an adoption application for a pet
 *     description: >
 *       The authenticated adopter applies for a specific pet. The application is
 *       created with applicationStatus = Pending. The pet must exist and be
 *       'available', and the adopter must not already have an active (Pending or
 *       Accepted) application for the same pet.
 *     tags: [Adoption Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petID, shelterID]
 *             properties:
 *               petID:
 *                 type: integer
 *               shelterID:
 *                 type: integer
 *                 description: Must match the pet's shelter
 *     responses:
 *       201:
 *         description: The created application record (applicationStatus = Pending)
 *       400:
 *         description: Missing/invalid petID or shelterID, or shelterID does not match the pet's shelter
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: No pet exists with the given ID
 *       409:
 *         description: Pet is not available, or the adopter already has an active application for it
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.createApplication,
);

module.exports = router;
