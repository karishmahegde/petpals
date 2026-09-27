// What it does: Defines the Staff/Admin inter-shelter transfer routes (POST
// /transfers, GET /transfers, GET /transfers/assignees, GET /transfers/:id,
// PATCH /transfers/:id, PATCH /transfers/:id/status) — mounted at /api/v1 in
// app.js. /transfers/assignees is registered before /transfers/:id so
// "assignees" is never captured as an :id. No adopter-facing surface exists
// for transfers at all, unlike adoption-applications.
const express = require("express");
const transfersController = require("../../controllers/staff/transfers.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /transfers:
 *   post:
 *     summary: Initiate an inter-shelter pet transfer (Staff, Admin)
 *     description: >
 *       fromShelterID is taken from the acting staff member's own shelter and
 *       is never read from the request body for that role; Admin has no home
 *       shelter, so fromShelterID is required in the body instead. Only a pet
 *       currently 'available' at the resolved fromShelterID may be
 *       transferred (409 otherwise). On success the pet's adoptionStatus
 *       becomes 'transferred' until the transfer is Approved, Declined, or
 *       Cancelled.
 *     tags: [Transfers, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petID, toShelterID, transferReason]
 *             properties:
 *               petID: { type: integer }
 *               toShelterID: { type: integer, description: Must differ from fromShelterID }
 *               transferReason: { type: string, maxLength: 300 }
 *               fromShelterID: { type: integer, description: Admin only — required for that role }
 *     responses:
 *       201:
 *         description: The created transfer
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/TransferDetail' }
 *       400:
 *         description: Missing/invalid field, toShelterID doesn't reference an existing shelter, or a shelter mismatch
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to transfer a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The pet isn't currently available for transfer, or (Staff) has no shelter assigned yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/transfers",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  transfersController.createTransfer,
);

/**
 * @swagger
 * /transfers:
 *   get:
 *     summary: List inter-shelter transfers touching the caller's shelter (Staff, Admin)
 *     description: >
 *       direction is required: 'incoming' scopes to transfers where the
 *       caller's shelter is the destination (Pending Transfers — awaiting
 *       this shelter's decision); 'outgoing' scopes to transfers this
 *       shelter sent (Ongoing Transfers). Staff is always scoped to their own
 *       shelter, resolved server-side; Admin may pass an explicit shelterID
 *       or omit it for a network-wide (unscoped) list. shelterName searches
 *       the OTHER shelter's name on the record.
 *     tags: [Transfers, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: direction
 *         required: true
 *         schema: { type: string, enum: [incoming, outgoing] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [In_Progress, Completed, Rejected, Cancelled] }
 *       - in: query
 *         name: shelterName
 *         schema: { type: string }
 *       - in: query
 *         name: petName
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
 *         description: Paginated list of transfers
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/TransferQueueItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Missing/invalid direction, status, or pagination param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/transfers",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  transfersController.listTransfers,
);

/**
 * @swagger
 * /transfers/assignees:
 *   get:
 *     summary: Preview the staff a new transfer will be assigned (Staff, Admin)
 *     description: >
 *       Resolves exactly what POST /transfers assigns — fromShelterStaff is
 *       the acting staff member (null for Admin), toShelterStaff is the
 *       destination shelter's manager (null if it has none, or if
 *       toShelterID is omitted).
 *     tags: [Transfers, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: toShelterID
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The resolved assignees
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         fromShelterStaff: { $ref: '#/components/schemas/TransferStaffOption' }
 *                         toShelterStaff: { $ref: '#/components/schemas/TransferStaffOption' }
 *       400:
 *         description: toShelterID is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/transfers/assignees",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  transfersController.getTransferAssignees,
);

/**
 * @swagger
 * /transfers/{id}:
 *   get:
 *     summary: Get one transfer's full detail (Staff, Admin)
 *     description: >
 *       Staff may only view a transfer touching their own shelter, on either
 *       side (fromShelter or toShelter); Admin may view any.
 *     tags: [Transfers, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The transfer's full detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/TransferDetail' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a transfer not touching their own shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/transfers/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  transfersController.getTransfer,
);

/**
 * @swagger
 * /transfers/{id}/status:
 *   patch:
 *     summary: Approve, decline, or cancel an in-progress transfer (Staff, Admin)
 *     description: >
 *       status must be one of Completed (approve), Rejected (decline), or
 *       Cancelled (retract) — In_Progress is a create-only value, never a
 *       client-settable target. Completed/Rejected may only be set by the
 *       DESTINATION shelter (toShelterID); Cancelled may only be set by the
 *       ORIGIN shelter (fromShelterID). Only an In_Progress transfer can be
 *       moved (409 otherwise). Completed reassigns the pet to its new
 *       shelter, clears its assigned staff, and sets adoptionStatus back to
 *       'available'; Rejected/Cancelled leave the pet at its original
 *       shelter and set adoptionStatus back to 'available' there.
 *     tags: [Transfers, Staff]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [Completed, Rejected, Cancelled] }
 *     responses:
 *       200:
 *         description: The updated transfer
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/TransferDetail' }
 *       400:
 *         description: Missing/invalid status or id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to act on a transfer from the wrong side (or another shelter entirely)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The transfer is no longer In_Progress
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/transfers/:id/status",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  transfersController.updateTransferStatus,
);

/**
 * @swagger
 * /transfers/{id}:
 *   patch:
 *     summary: Reassign a transfer's destination staff (destination Manager, Admin)
 *     description: >
 *       toShelterStaff is the only editable field. Only the destination
 *       shelter's manager (Shelter.managerStaffID) or an Admin may set it,
 *       only while the transfer is In_Progress, and only to an Active staff
 *       member at the destination shelter.
 *     tags: [Transfers, Staff]
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
 *             required: [toShelterStaff]
 *             properties:
 *               toShelterStaff: { type: integer }
 *     responses:
 *       200:
 *         description: The updated transfer
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/TransferDetail' }
 *       400:
 *         description: Invalid id/toShelterStaff, or the staff member isn't active at the destination shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Caller isn't the destination shelter's manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The transfer is no longer In_Progress
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/transfers/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  transfersController.updateTransfer,
);

module.exports = router;
