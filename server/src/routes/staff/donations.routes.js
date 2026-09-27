// What it does: Defines the Staff/Admin read-only donation routes (GET
// /donations, GET /donations/stats, GET /donations/:id) — mounted at /api/v1
// in app.js. /donations/stats is registered before /donations/:id so
// "stats" is never captured as an :id. Staff is always scoped to their own
// shelter. Creating donations (donor checkout) is a separate, later flow.
const express = require("express");
const donationsController = require("../../controllers/staff/donations.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /donations:
 *   get:
 *     summary: List donations received at the caller's shelter (Staff, Admin)
 *     description: >
 *       Newest first. dateFrom/dateTo bound donationDate (the client computes
 *       them so "this month" follows its own timezone). donorName is a
 *       case-insensitive contains-match. Staff is always scoped to their own
 *       shelter; Admin may pass shelterID or omit it for network-wide.
 *     tags: [Donations, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: donorName
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
 *         description: Paginated list of donations
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
 *                           donationID: { type: integer }
 *                           donationCode: { type: string, example: DON-00123 }
 *                           donationDate: { type: string, format: date-time }
 *                           donationAmt: { type: number }
 *                           donorName: { type: string }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid date, shelterID, or pagination param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/donations",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  donationsController.listDonations,
);

/**
 * @swagger
 * /donations/stats:
 *   get:
 *     summary: Donation totals for the caller's shelter (Staff, Admin)
 *     description: >
 *       Over all of the shelter's donations (not the list's filters):
 *       total amount, number of distinct donors, and the amount since
 *       monthStart (the client's local start of the current month).
 *     tags: [Donations, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: monthStart
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer, description: Admin only }
 *     responses:
 *       200:
 *         description: The totals
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
 *                         totalAmount: { type: number }
 *                         totalDonors: { type: integer }
 *                         thisMonthAmount: { type: number }
 *       400:
 *         description: Missing/invalid monthStart, or invalid shelterID
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/donations/stats",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  donationsController.getDonationStats,
);

/**
 * @swagger
 * /donations/{id}:
 *   get:
 *     summary: Get one donation with its donor's contact details (Staff, Admin)
 *     description: >
 *       Staff may only view donations at their own shelter; Admin may view
 *       any. The donor's Stripe customer ID is never included.
 *     tags: [Donations, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The donation
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
 *                         donationID: { type: integer }
 *                         donationCode: { type: string, example: DON-00123 }
 *                         donationDate: { type: string, format: date-time }
 *                         donationAmt: { type: number }
 *                         donationDesc: { type: string, nullable: true }
 *                         donor:
 *                           type: object
 *                           properties:
 *                             donorName: { type: string }
 *                             donorEmail: { type: string }
 *                             donorPhone: { type: string, nullable: true }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a donation at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/donations/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  donationsController.getDonation,
);

module.exports = router;
