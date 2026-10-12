// Compatibility-matcher results — mounted at /api/v1 in app.js, beside the
// quiz router.
const express = require("express");
const controller = require("../../controllers/adopter/matches.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /adopters/me/matches:
 *   get:
 *     summary: Get the logged-in adopter's top compatibility matches
 *     description: >
 *       Best first, from the AdopterMatch cache — the AI is only called when
 *       the cache is stale (nothing cached, or a pet changed since it was
 *       computed). Pets no longer available, and pets the adopter already has
 *       a Pending/Accepted application for, are left out. No quiz yet →
 *       quizComplete false and an empty list (200, not an error).
 *     tags: [Match Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 20, default: 3 }
 *     responses:
 *       200:
 *         description: The adopter's top matches
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterMatches' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/adopters/me/matches",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.getMyMatches,
);

module.exports = router;
