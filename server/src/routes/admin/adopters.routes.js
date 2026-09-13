// What it does: Defines the Admin-only adopter oversight routes — mounted at
// /api/v1/adopters in app.js, alongside (not instead of) the adopter's own
// /adopters/me routes in routes/adopter/adopters.routes.js.
const express = require("express");
const adoptersController = require("../../controllers/admin/adopters.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /adopters:
 *   get:
 *     summary: List every adopter account (Admin only)
 *     description: >
 *       Paginated, org-wide adopter listing for admin oversight. Never
 *       includes governmentID or stripeCustomerID.
 *     tags: [Adopters, Admin]
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
 *         schema: { type: string, enum: [Active, Banned, Deactivated] }
 *       - in: query
 *         name: adopterRiskFlag
 *         schema: { type: boolean }
 *         description: When exactly "true", returns only flagged adopters
 *     responses:
 *       200:
 *         description: Paginated adopter list, ordered by adopterName ascending
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AdopterListItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adoptersController.listAdopters,
);

/**
 * @swagger
 * /adopters/{id}/status:
 *   patch:
 *     summary: Ban, deactivate, or reactivate an adopter account (Admin only)
 *     description: >
 *       Banned/Deactivated adopters are rejected on their next login attempt
 *       (POST /auth/login). Transitioning to Banned or Deactivated also nulls
 *       the adopter's stored refresh token, so an already-issued one can't
 *       keep minting fresh access tokens until it expires.
 *     tags: [Adopters, Admin]
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
 *                 enum: [Active, Banned, Deactivated]
 *     responses:
 *       200:
 *         description: The updated adopter summary
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterListItem' }
 *       400:
 *         description: accountStatus missing or not one of Active/Banned/Deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  adoptersController.updateAdopterStatus,
);

module.exports = router;
