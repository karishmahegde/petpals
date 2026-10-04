// What it does: Defines a donor's donation routes — the Stripe Checkout entry
// point (POST /donations/checkout) and their own history and totals (GET
// /donors/me/donations[/stats|/:id]). The Donation row itself is created by
// the Stripe webhook after payment (routes/webhooks/stripe.routes.js).
// Mounted at /api/v1 in app.js; the staff GET /donations… routes are
// separate.
const express = require("express");
const donationsController = require("../../controllers/donor/donations.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /donations/checkout:
 *   post:
 *     summary: Start a donation through Stripe Checkout (Donor only)
 *     description: >
 *       Returns a Stripe Checkout URL. No Donation row is created here — the
 *       Stripe webhook records it once payment is confirmed, with the amount
 *       Stripe actually charged. amount is whole US dollars, 1–10000. A
 *       Closed shelter can't take donations (409); Open and Full ones can.
 *       After paying, Stripe returns the donor to
 *       /donor/donate/confirmation?session_id=…; cancelling returns them to
 *       /donor/donate.
 *     tags: [Donations, Donors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shelterID, amount]
 *             properties:
 *               shelterID: { type: integer }
 *               amount: { type: integer, minimum: 1, maximum: 10000, description: Whole US dollars }
 *               donationDesc: { type: string, maxLength: 300, nullable: true }
 *     responses:
 *       201:
 *         description: Checkout session created
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
 *                         checkoutUrl: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The shelter is Closed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/donations/checkout",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donationsController.createCheckout,
);

/**
 * @swagger
 * /donors/me/donations:
 *   get:
 *     summary: The logged-in donor's donations (Donor only)
 *     description: >
 *       Two uses on one path, like GET /adoption-applications. With
 *       ?checkoutSessionId= it's the confirmation page's poll for the
 *       donation the Stripe webhook records — data is that donation, or null
 *       while the webhook hasn't landed yet. Otherwise it's the donor's
 *       history, newest first — optional shelterID and dateFrom (inclusive)
 *       / dateTo (exclusive) filters, paginated. Each item: donationID,
 *       donationCode, donationDate, donationAmt, donationDesc and the
 *       shelter (shelterID, shelterName). Never the Stripe IDs.
 *     tags: [Donations, Donors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: checkoutSessionId
 *         schema: { type: string }
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: The donor's donations (paginated), or the one donation for a checkout session (null if not recorded yet)
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/donors/me/donations",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donationsController.listMyDonations,
);

/**
 * @swagger
 * /donors/me/donations/stats:
 *   get:
 *     summary: The logged-in donor's giving totals (Donor only)
 *     description: >
 *       Over all of the donor's donations (not the history list's filters):
 *       totalAmount, donationCount, thisYearAmount (since yearStart — the
 *       client's local start of the year, so it follows the donor's
 *       timezone) and byShelter (shelterID, shelterName, totalAmount,
 *       donationCount — largest total first).
 *     tags: [Donations, Donors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: yearStart
 *         required: true
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: The donor's totals
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/DonorDonationStats' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// Registered before /:id so "stats" is never read as a donation ID.
router.get(
  "/donors/me/donations/stats",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donationsController.getMyDonationStats,
);

/**
 * @swagger
 * /donors/me/donations/{id}:
 *   get:
 *     summary: One of the logged-in donor's donations (Donor only)
 *     description: Same item shape as the history list. Another donor's donation is 404, exactly like a missing one.
 *     tags: [Donations, Donors]
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
 *                     data: { $ref: '#/components/schemas/DonorDonation' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/donors/me/donations/:id",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donationsController.getMyDonation,
);

module.exports = router;
