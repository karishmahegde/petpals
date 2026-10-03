// What it does: Defines the vet dashboard Overview's extra reads — overdue
// vaccinations at the vet's shelter (GET /vets/me/vaccinations/overdue) and
// the vet's own stats (GET /vets/me/stats). Mounted at /api/v1 in app.js.
// Plain authenticate, so a Pending vet can't reach them.
const express = require("express");
const overviewController = require("../../controllers/vet/overview.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /vets/me/vaccinations/overdue:
 *   get:
 *     summary: List overdue vaccinations at the logged-in veterinarian's shelter (Veterinarian only)
 *     description: >
 *       For each pet at the vet's shelter (excluding adopted and deceased
 *       pets) and each vaccine it has had, only the latest dose counts — it
 *       is overdue when its dueDate has passed. doseNumber is the dose now
 *       due (doses given + 1). Most overdue first; not paginated.
 *     tags: [Vaccines, Vets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue vaccinations
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           petID: { type: integer }
 *                           petName: { type: string }
 *                           petPhoto: { type: string, nullable: true }
 *                           vaccineID: { type: integer }
 *                           vaccineName: { type: string }
 *                           doseNumber: { type: integer, example: 2 }
 *                           dueDate: { type: string, format: date-time }
 *                           daysOverdue: { type: integer, example: 13 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/vets/me/vaccinations/overdue",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  overviewController.listOverdueVaccinations,
);

/**
 * @swagger
 * /vets/me/stats:
 *   get:
 *     summary: The logged-in veterinarian's dashboard stats (Veterinarian only)
 *     description: >
 *       petsTreated — distinct pets the vet has seen at an appointment that
 *       has already happened and wasn't cancelled.
 *     tags: [Vets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The stats
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
 *                         petsTreated: { type: integer, example: 23 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/vets/me/stats",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  overviewController.getMyStats,
);

module.exports = router;
