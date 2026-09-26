// What it does: Defines the shelter-manager veterinarian routes (GET
// /staff/me/vets, PATCH /staff/me/vets/:id/status) — mounted at /api/v1 in
// app.js, before the Admin /staff/:id router so "me" is never captured as
// an :id (same as routes/staff/shelterStaff.routes.js). Staff role only; the
// service further restricts every call to the caller's own shelter, and
// only if they are its manager (Shelter.managerStaffID).
const express = require("express");
const vetsController = require("../../controllers/staff/vets.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /staff/me/vets:
 *   get:
 *     summary: List the veterinarians at the caller's shelter (shelter manager)
 *     description: >
 *       section=pending lists vets awaiting approval; section=all lists
 *       approved vets (Active or Deactivated), optionally narrowed by
 *       accountStatus. name is a case-insensitive contains match.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: section
 *         required: true
 *         schema: { type: string, enum: [all, pending] }
 *       - in: query
 *         name: accountStatus
 *         schema: { type: string, enum: [Active, Deactivated] }
 *         description: section=all only
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: A page of veterinarians
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ShelterVet' }
 *       400:
 *         description: Missing/invalid section, or invalid accountStatus/page/limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Caller isn't a shelter manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/staff/me/vets",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  vetsController.listVets,
);

/**
 * @swagger
 * /staff/me/vets/{id}/status:
 *   patch:
 *     summary: Approve, decline, or deactivate a veterinarian (shelter manager)
 *     description: >
 *       Pending → Active (approve), Pending → Deactivated (decline),
 *       Active → Deactivated (deactivate); anything else is 409. The vet
 *       must be at the caller's shelter.
 *     tags: [Staff]
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
 *         description: The updated veterinarian
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/ShelterVet' }
 *       400:
 *         description: Invalid id or accountStatus
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not a manager, or the vet is at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Transition not allowed from the current status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/staff/me/vets/:id/status",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  vetsController.updateVetStatus,
);

module.exports = router;
