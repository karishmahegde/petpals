// What it does: Defines the Admin-only /analytics routes — mounted at
// /api/v1 in app.js.
const express = require("express");
const analyticsController = require("../../controllers/admin/analytics.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /analytics/overview:
 *   get:
 *     summary: Org-wide KPI summary for the Admin dashboard (Admin only)
 *     description: >
 *       Four grouped-count queries — shelters by shelterStatus, pets by
 *       adoptionStatus, adopters by accountStatus, adoption applications by
 *       applicationStatus — no per-shelter or per-pet loops. adoptionRate is
 *       Accepted / total applications as a 0-1 fraction rounded to 2 decimal
 *       places, or null if there are no applications yet.
 *     tags: [Analytics, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The overview KPI payload
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AnalyticsOverview' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/analytics/overview",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  analyticsController.getOverview,
);

/**
 * @swagger
 * /analytics/shelters:
 *   get:
 *     summary: Per-shelter capacity breakdown (Admin only)
 *     description: >
 *       For each shelter: identifying/contact fields, shelterStatus, current
 *       manager (managerStaffID + managerName), active staff count, pet
 *       count (total and by adoptionStatus), open (Pending) application
 *       count, shelterSize, and utilization % (pet count / shelterSize, as a
 *       percentage rounded to 2dp — null for a 0-capacity shelter). Ordered
 *       by shelterName ascending by default — the one endpoint behind the
 *       Admin Shelters tab (list + edit-form pre-fill), not just capacity
 *       analytics.
 *     tags: [Analytics, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [utilization, petCount] }
 *         description: >
 *           Rank shelters highest-first by utilization or by pet count,
 *           instead of the default alphabetical order.
 *     responses:
 *       200:
 *         description: The per-shelter breakdown, not paginated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ShelterAnalyticsItem' }
 *       400:
 *         description: sortBy is not one of utilization/petCount
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/analytics/shelters",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  analyticsController.getShelterBreakdown,
);

/**
 * @swagger
 * /analytics/monthly-stats:
 *   get:
 *     summary: Jan-Dec Intake vs. Adoptions counts for one calendar year, for the Admin Overview chart (Admin only)
 *     description: >
 *       Twelve points, January through December of the given `year`. Intake
 *       counts pets by Pet.intakeDate; Adoptions counts applications with
 *       applicationStatus 'Accepted' by their submission month
 *       (AdoptionApplication.createdAt) — the schema has no separate
 *       "accepted on" timestamp, the same approximation adoptionRate already
 *       makes in GET /analytics/overview.
 *     tags: [Analytics, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, minimum: 2000, example: 2026 }
 *         description: Calendar year to report on. Defaults to the current year; cannot be after it.
 *     responses:
 *       200:
 *         description: Monthly stats for the year, January first
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/MonthlyStatsPoint' }
 *       400:
 *         description: year is not an integer between 2000 and the current year
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/analytics/monthly-stats",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  analyticsController.getMonthlyStats,
);

module.exports = router;
