// What it does: Defines the shelter-manager staff routes (GET /staff/me/team,
// PATCH /staff/me/team/:id, PATCH /staff/me/team/:id/status) — mounted at
// /api/v1 in app.js, before the Admin /staff/:id router so "me" is never
// captured as an :id. Staff role only; the service further restricts every
// call to the caller's own shelter, and only if they are its manager
// (Shelter.managerStaffID).
const express = require("express");
const shelterStaffController = require("../../controllers/staff/shelterStaff.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /staff/me/team:
 *   get:
 *     summary: List staff at the shelter the caller manages (shelter manager)
 *     description: >
 *       section=pending lists registrations awaiting approval; section=all
 *       lists approved staff (Active or Deactivated), the manager included.
 *       403 if the caller isn't a shelter's manager.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: section
 *         required: true
 *         schema: { type: string, enum: [all, pending] }
 *       - in: query
 *         name: staffDesignation
 *         schema: { type: string, enum: [Manager, Senior, Associate] }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Case-insensitive match on staffName.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated staff list, ordered by name
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ShelterStaffMember' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Missing/invalid section, designation, or pagination param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Caller isn't a shelter's manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/staff/me/team",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  shelterStaffController.listShelterStaff,
);

/**
 * @swagger
 * /staff/me/team/{id}:
 *   patch:
 *     summary: Change a staff member's designation (shelter manager)
 *     description: >
 *       Designation is the only editable field, and only Senior/Associate
 *       may be assigned — Manager is Admin-controlled. The target must be an
 *       Active staff member at the caller's shelter, not the caller.
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
 *             required: [staffDesignation]
 *             properties:
 *               staffDesignation: { type: string, enum: [Senior, Associate] }
 *     responses:
 *       200:
 *         description: The updated staff member
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/ShelterStaffMember' }
 *       400:
 *         description: Invalid id or designation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not a manager, another shelter's staff, the caller themself, or a Manager target
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The staff member isn't Active
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/staff/me/team/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  shelterStaffController.updateShelterStaffMember,
);

/**
 * @swagger
 * /staff/me/team/{id}/status:
 *   patch:
 *     summary: Approve, decline, or deactivate a staff member (shelter manager)
 *     description: >
 *       Pending → Active (approve), Pending → Deactivated (decline),
 *       Active → Deactivated (deactivate); anything else is 409. The target
 *       must be at the caller's shelter and not the caller. Approving also
 *       sets the new member's designation — staffDesignation (Senior or
 *       Associate) is required then (400 otherwise). A Pending Manager
 *       sign-up is approved by an Admin, not here (403).
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
 *               staffDesignation:
 *                 type: string
 *                 enum: [Senior, Associate]
 *                 description: Required when approving a Pending member
 *     responses:
 *       200:
 *         description: The updated staff member
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/ShelterStaffMember' }
 *       400:
 *         description: Invalid id or accountStatus
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not a manager, another shelter's staff, or the caller themself
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
  "/staff/me/team/:id/status",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  shelterStaffController.updateShelterStaffStatus,
);

module.exports = router;
