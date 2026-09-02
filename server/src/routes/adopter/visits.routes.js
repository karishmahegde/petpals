// Defines the /visits routes — mounted at /api/v1/visits in app.js
const express = require("express");
const controller = require("../../controllers/adopter/visits.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /visits:
 *   post:
 *     summary: Schedule a shelter visit or virtual meet-and-greet
 *     description: >
 *       The authenticated adopter schedules a visit. petID is optional — omit or
 *       null it for a general shelter visit. visitTime must be in the future.
 *     tags: [Visits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shelterID, visitTime]
 *             properties:
 *               shelterID:
 *                 type: integer
 *               petID:
 *                 type: integer
 *                 nullable: true
 *               visitTime:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 datetime, must be in the future
 *               remarks:
 *                 type: string
 *                 maxLength: 300
 *     responses:
 *       201:
 *         description: The created visit record
 *       400:
 *         description: Missing/invalid shelterID or petID, invalid visitTime, or visitTime in the past
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: No shelter (or referenced pet) exists with the given ID
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.createVisit,
);

module.exports = router;
