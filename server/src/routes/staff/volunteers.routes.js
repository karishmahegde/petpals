// What it does: Defines the Staff/Admin volunteer-management routes (GET
// /volunteers, GET /volunteers/:id, PATCH /volunteers/:id/status) — mounted
// at /api/v1 in app.js. Staff is always scoped to their own shelter.
const express = require("express");
const volunteersController = require("../../controllers/staff/volunteers.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /volunteers:
 *   get:
 *     summary: List volunteers at the caller's shelter (Staff, Admin)
 *     description: >
 *       Staff is always scoped to their own shelter, resolved server-side;
 *       Admin may pass an explicit shelterID or omit it for a network-wide
 *       list. name is a case-insensitive contains-match on volunteerName.
 *     tags: [Volunteers, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: accountStatus
 *         schema: { type: string, enum: [Pending, Active, Banned, Deactivated] }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer, description: Admin only }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of volunteers
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/VolunteerListItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid accountStatus, shelterID, or pagination param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/volunteers",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  volunteersController.listVolunteers,
);

/**
 * @swagger
 * /volunteers/{id}:
 *   get:
 *     summary: Get one volunteer's full profile (Staff, Admin)
 *     description: >
 *       Every Volunteer column plus login email and government ID type/number
 *       (null if none submitted). Staff may only view volunteers at their own
 *       shelter; Admin may view any.
 *     tags: [Volunteers, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The volunteer's full profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/VolunteerDetail' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a volunteer at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/volunteers/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  volunteersController.getVolunteer,
);

/**
 * @swagger
 * /volunteers/{id}/status:
 *   patch:
 *     summary: Approve, decline, or deactivate a volunteer (Staff, Admin)
 *     description: >
 *       Allowed transitions — Pending → Active (approve), Pending →
 *       Deactivated (decline), Active → Deactivated (deactivate). Anything
 *       else is 409. Staff may only act on volunteers at their own shelter.
 *     tags: [Volunteers, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountStatus]
 *             properties:
 *               accountStatus: { type: string, enum: [Active, Deactivated] }
 *     responses:
 *       200:
 *         description: The updated volunteer
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/VolunteerDetail' }
 *       400:
 *         description: Missing/invalid accountStatus or id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to act on a volunteer at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The transition isn't allowed from the volunteer's current status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/volunteers/:id/status",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  volunteersController.updateVolunteerStatus,
);

module.exports = router;
