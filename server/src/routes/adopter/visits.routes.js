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
 *         description: The created visit record (visitStatus is null until a staff member confirms it)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Visit' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.createVisit,
);

/**
 * @swagger
 * /visits/{id}:
 *   patch:
 *     summary: Cancel a scheduled visit
 *     description: >
 *       Adopter-only. The adopter may cancel their own visit, provided it
 *       hasn't already passed and isn't already Cancelled or Completed.
 *       Staff confirming or completing a visit is not handled here yet.
 *     tags: [Visits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [visitStatus]
 *             properties:
 *               visitStatus:
 *                 type: string
 *                 enum: [Cancelled]
 *     responses:
 *       200:
 *         description: The cancelled visit, with shelter name and (when set) pet name
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/VisitListItem' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Role not permitted, or an adopter acting on another adopter's visit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The visit has already passed, or is already Cancelled/Completed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/:id",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.cancelVisit,
);

module.exports = router;
