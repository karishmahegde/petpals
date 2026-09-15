// What it does: Defines the Admin-only /admins routes — mounted at /api/v1 in app.js.
const express = require("express");
const adminsController = require("../../controllers/admin/admins.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const { singleFile } = require("../../middleware/upload");
const router = express.Router();

/**
 * @swagger
 * /admins:
 *   get:
 *     summary: List every admin account (Admin only)
 *     description: Paginated admin listing, including self-registered accounts awaiting approval.
 *     tags: [Admins, Admin]
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
 *         name: accountStatus
 *         schema: { type: string, enum: [Pending, Active, Deactivated] }
 *         description: >
 *           Optional filter by account status. Pending is a self-registered
 *           account awaiting approval by an existing admin.
 *     responses:
 *       200:
 *         description: Paginated admin list, ordered by adminName ascending
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/admins",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.listAdmins,
);

/**
 * @swagger
 * /admins/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in admin
 *     tags: [Admins, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The admin profile
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     summary: Update the profile of the currently logged-in admin
 *     description: >
 *       Partial update — only avatarSeed and/or adminName may be sent.
 *       accountStatus is rejected with 400 (that's PATCH /admins/:id/status,
 *       set by another admin, not self-service).
 *     tags: [Admins, Admin]
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
 *               adminName: { type: string, maxLength: 45 }
 *     responses:
 *       200:
 *         description: The updated admin profile
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   delete:
 *     summary: Deactivate or permanently delete your own admin account
 *     description: >
 *       'deactivate' keeps the row (accountStatus → Deactivated, refresh
 *       token cleared); 'delete' permanently removes the Admin and Users
 *       rows. No "last active Admin" guard — this is self-service on your
 *       own account, unlike PATCH /admins/:id/status which blocks
 *       self-deactivation.
 *     tags: [Admins, Admin]
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
 *       422:
 *         description: mode is missing or not one of 'deactivate'/'delete'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/admins/me",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.getMyProfile,
);
router.put(
  "/admins/me",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.updateMyProfile,
);
router.delete(
  "/admins/me",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.closeMyAccount,
);

/**
 * @swagger
 * /admins/me/government-id:
 *   get:
 *     summary: Get the logged-in admin's submitted government ID (Admin only)
 *     description: Metadata only — idNumber is masked, the document itself is not returned. Self-only, never exposed via GET /admins/:id.
 *     tags: [Admins, Admin]
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
 *     summary: Submit a government ID for identity verification (Admin only)
 *     description: >
 *       One per admin (`@@unique([userID, userType])`) — a second submission
 *       is rejected with 409, except a Rejected record, which can be
 *       resubmitted (overwrites the row, resets it to Pending).
 *     tags: [Admins, Admin]
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
 *         description: A government ID already exists for this admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/admins/me/government-id",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.getGovernmentId,
);
router.post(
  "/admins/me/government-id",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  singleFile("file"),
  adminsController.uploadGovernmentId,
);

/**
 * @swagger
 * /admins/{id}:
 *   get:
 *     summary: Full detail for one admin account (Admin only)
 *     tags: [Admins, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The admin detail
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/admins/:id",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.getAdminDetail,
);

/**
 * @swagger
 * /admins/{id}/status:
 *   patch:
 *     summary: Activate or deactivate an admin account (Admin only)
 *     description: >
 *       This is also how a self-registered (Pending) admin account is
 *       approved or declined — setting accountStatus to 'Active' approves it,
 *       'Deactivated' declines it. There is no distinct approve/decline
 *       endpoint. An admin cannot deactivate their own account. A
 *       Deactivated (or still-Pending) admin account is rejected on its next
 *       login attempt (POST /auth/login) — existing already-issued access
 *       tokens are unaffected until they expire.
 *     tags: [Admins, Admin]
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
 *         description: The updated admin detail
 *       400:
 *         description: accountStatus missing/invalid, or attempting to deactivate your own account
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/admins/:id/status",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adminsController.updateAdminStatus,
);

module.exports = router;
