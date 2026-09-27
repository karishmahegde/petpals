// What it does: Defines the Staff/Admin ID-verification routes (GET
// /government-ids, GET /government-ids/:id, PATCH
// /government-ids/:id/status) — mounted at /api/v1 in app.js. Who reviews
// whose ID: Admin → Managers and other Admins; a shelter's manager → its
// Staff, Vets, Volunteers, Adopters; other staff → Adopters and Volunteers (see
// services/staff/governmentIds.service.js).
const express = require("express");
const governmentIdsController = require("../../controllers/staff/governmentIds.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /government-ids:
 *   get:
 *     summary: List government ID records awaiting or already reviewed (Staff, Admin)
 *     description: >
 *       Who sees whose IDs: a shelter's manager → its Staff, Veterinarians,
 *       Volunteers, and Adopters; any other staff member → Adopters and
 *       Volunteers;
 *       Admin → shelter Managers and other Admins (network-wide, or one
 *       shelter's Manager with shelterID). Staff-side lists are scoped to
 *       people connected to the caller's shelter — an Adopter with at least
 *       one AdoptionApplication there, anyone else by their own shelterID.
 *       A userType filter the caller doesn't review returns an empty page;
 *       the caller's own ID is never listed.
 *       section=pending -> verificationStatus Pending; section=reviewed ->
 *       Verified or Rejected.
 *     tags: [GovernmentIds, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: section
 *         required: true
 *         schema: { type: string, enum: [pending, reviewed] }
 *       - in: query
 *         name: userType
 *         schema: { type: string, enum: [Adopter, Volunteer, Staff, Veterinarian, Admin] }
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
 *         description: Paginated list of government ID records
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/GovernmentIdQueueItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Missing/invalid query param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/government-ids",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  governmentIdsController.listGovernmentIds,
);

/**
 * @swagger
 * /government-ids/{id}:
 *   get:
 *     summary: Get one government ID record's full detail (Staff, Admin)
 *     description: >
 *       Unlike every other place GovernmentID is exposed, this returns the
 *       FULL (unmasked) idNumber and a short-lived signed URL for the actual
 *       document image — this is the dedicated, authorized verification
 *       workflow the field and the private government-ids bucket exist for.
 *       Same who-reviews-whom rules as the list (403 otherwise), and never
 *       the caller's own record.
 *     tags: [GovernmentIds, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The record's full detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/GovernmentIdDetail' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a record outside their own shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: >
 *           No such record, or it belongs to a Staff/Veterinarian/Admin
 *           user (out of this feature's scope — never discoverable here)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/government-ids/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  governmentIdsController.getGovernmentId,
);

/**
 * @swagger
 * /government-ids/{id}/status:
 *   patch:
 *     summary: Verify or reject a Pending government ID record (Staff, Admin)
 *     description: >
 *       Only a Pending record can be reviewed. Same who-reviews-whom rules
 *       as the list (403 otherwise), and never the caller's own record.
 *     tags: [GovernmentIds, Staff]
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
 *             required: [verificationStatus]
 *             properties:
 *               verificationStatus: { type: string, enum: [Verified, Rejected] }
 *     responses:
 *       200:
 *         description: The updated record
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/GovernmentIdDetail' }
 *       400:
 *         description: Missing/invalid verificationStatus
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to review a record outside their own shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The record is no longer Pending
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/government-ids/:id/status",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  governmentIdsController.updateGovernmentIdStatus,
);

module.exports = router;
