// What it does: Defines the Admin-only /staff routes — mounted at /api/v1 in app.js.
const express = require("express");
const staffController = require("../../controllers/admin/staff.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /staff:
 *   get:
 *     summary: List every staff member across all shelters (Admin only)
 *     description: Paginated, org-wide staff listing for admin oversight.
 *     tags: [Staff, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer }
 *         description: Optional filter to staff at a single shelter
 *       - in: query
 *         name: staffDesignation
 *         schema: { type: string, enum: [Manager, Senior, Associate] }
 *         description: Optional filter by designation
 *       - in: query
 *         name: accountStatus
 *         schema: { type: string, enum: [Pending, Active, Deactivated] }
 *         description: >
 *           Optional filter by account status. Pending is a self-registered
 *           account awaiting approval (a Manager sign-up by an Admin, anyone
 *           else by their shelter's manager).
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Case-insensitive contains match on staffName
 *       - in: query
 *         name: awaitingAdmin
 *         schema: { type: boolean }
 *         description: >
 *           When exactly "true", returns only the Pending Manager sign-ups
 *           an Admin approves (overrides accountStatus).
 *     responses:
 *       200:
 *         description: Paginated staff list, ordered by staffName ascending
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/StaffListItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/staff",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  staffController.listStaff,
);

/**
 * @swagger
 * /staff/{id}:
 *   get:
 *     summary: Full detail for one staff member (Admin only)
 *     description: >
 *       Includes the shelter name and, if this staff member currently manages
 *       any shelter(s), the managedShelters list.
 *     tags: [Staff, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The staff detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/StaffDetail' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     summary: Update a staff member's designation and/or shelter assignment (Admin only)
 *     description: >
 *       Partial update — only staffDesignation and/or shelterID may be sent
 *       (account activation is PATCH /staff/:id/status, a separate endpoint).
 *       If shelterID changes and this staff member currently manages their
 *       old shelter, that shelter's managerStaffID is cleared automatically.
 *       Staff.staffDesignation and Shelter.managerStaffID are kept in sync:
 *       setting staffDesignation to 'Manager' makes this staff member the
 *       managerStaffID of their (possibly newly-assigned) shelter, overwriting
 *       any previous manager there; moving a Manager away from 'Manager' (or
 *       away from a shelter) clears managerStaffID on the shelter they were
 *       managing.
 *     tags: [Staff, Admin]
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
 *           schema: { $ref: '#/components/schemas/StaffUpdate' }
 *     responses:
 *       200:
 *         description: The updated staff detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/StaffDetail' }
 *       400:
 *         description: No updatable fields provided, invalid staffDesignation/shelterID, or shelterID does not reference an existing shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/staff/:id",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  staffController.getStaffDetail,
);
router.patch(
  "/staff/:id",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  staffController.updateStaff,
);

/**
 * @swagger
 * /staff/{id}/status:
 *   patch:
 *     summary: Activate or deactivate a staff account (Admin only)
 *     description: >
 *       This is also how a self-registered (Pending) staff account is
 *       approved or declined — setting accountStatus to 'Active' approves it,
 *       'Deactivated' declines it. There is no distinct approve/decline
 *       endpoint. Admin may only approve/decline a Pending *Manager*
 *       sign-up (403 otherwise — the shelter's manager approves everyone
 *       else from the Staff tab); approving one also makes them their
 *       shelter's manager (409 if it already has one). Deactivating clears managerStaffID on every shelter this
 *       staff member currently manages. A Deactivated (or still-Pending)
 *       staff account is rejected on its next login attempt
 *       (POST /auth/login) — existing already-issued access tokens are
 *       unaffected until they expire. Pending itself is never an accepted
 *       target here — an admin approves or declines, never manually reverts
 *       someone back to Pending.
 *     tags: [Staff, Admin]
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
 *               accountStatus:
 *                 type: string
 *                 enum: [Active, Deactivated]
 *     responses:
 *       200:
 *         description: The updated staff detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/StaffDetail' }
 *       400:
 *         description: accountStatus missing or not one of Active/Deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not an Admin, or a Pending account that isn't a Manager sign-up
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/staff/:id/status",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  staffController.updateStaffStatus,
);

module.exports = router;
