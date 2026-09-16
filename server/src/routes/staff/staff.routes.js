// What it does: Defines the Staff self-service /staff/me routes — mounted at
// /api/v1 in app.js, BEFORE routes/admin/staff.routes.js. Mount order
// matters here: admin/staff.routes.js has GET /staff/:id, and Express would
// otherwise match "/staff/me" against that pattern (:id="me") before ever
// reaching this router.
const express = require("express");
const staffController = require("../../controllers/staff/staff.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const { singleFile } = require("../../middleware/upload");
const router = express.Router();

/**
 * @swagger
 * /staff/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The staff profile
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     summary: Update the profile of the currently logged-in staff member
 *     description: >
 *       Partial update — only avatarSeed, staffName, staffPhone, staffDOB,
 *       and/or staffSex may be sent. shelterID, staffDesignation, and
 *       accountStatus are rejected with 400 — those are Admin-controlled via
 *       PATCH /staff/:id and PATCH /staff/:id/status, not self-service.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avatarSeed: { type: string, maxLength: 64 }
 *               staffName: { type: string, maxLength: 45 }
 *               staffPhone: { type: string, nullable: true }
 *               staffDOB: { type: string, format: date, nullable: true }
 *               staffSex: { type: string, enum: [M, F, O], nullable: true }
 *     responses:
 *       200:
 *         description: The updated staff profile
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/staff/me",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  staffController.getMyProfile,
);
router.put(
  "/staff/me",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  staffController.updateMyProfile,
);

/**
 * @swagger
 * /staff/me/government-id:
 *   get:
 *     summary: Get the logged-in staff member's submitted government ID (Staff only)
 *     description: >
 *       idNumber is masked (e.g. *****4567) on this response, same as the
 *       POST response — never returned in full on either route. Self-only,
 *       never exposed via the admin-side GET /staff/:id.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The government ID record
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: No government ID has been submitted yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   post:
 *     summary: Submit a government ID for identity verification (Staff only)
 *     description: >
 *       One per staff member (`@@unique([userID, userType])`) — a second
 *       submission is rejected with 409, except a Rejected record, which can
 *       be resubmitted (overwrites the row, resets it to Pending).
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [idType, idNumber, file]
 *             properties:
 *               idType: { type: string, maxLength: 45 }
 *               idNumber: { type: string, maxLength: 45 }
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: The created/resubmitted government ID record
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: A government ID already exists for this staff member
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/staff/me/government-id",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  staffController.getGovernmentId,
);
router.post(
  "/staff/me/government-id",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  singleFile("file"),
  staffController.uploadGovernmentId,
);

/**
 * @swagger
 * /staff/me:
 *   delete:
 *     summary: Deactivate or permanently delete your own staff account (Staff only)
 *     description: >
 *       'deactivate' keeps the row (accountStatus → Deactivated, refresh
 *       token cleared); 'delete' permanently removes the Staff and Users
 *       rows. Either mode clears managerStaffID on every shelter this staff
 *       member currently manages, and is blocked with 409 CONFLICT while
 *       they have a Pending application assigned to them — reassign or
 *       resolve it first.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mode]
 *             properties:
 *               mode: { type: string, enum: [deactivate, delete] }
 *     responses:
 *       200:
 *         description: Account deactivated or deleted
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: A Pending application is still assigned to this staff member
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: mode is missing or not one of 'deactivate'/'delete'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete(
  "/staff/me",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  staffController.closeMyAccount,
);

module.exports = router;
