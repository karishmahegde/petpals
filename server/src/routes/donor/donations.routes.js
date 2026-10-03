// What it does: Defines a donor's Stripe Checkout entry point (POST
// /donations/checkout). The Donation row itself is created by the Stripe
// webhook after payment (routes/webhooks/stripe.routes.js). Mounted at
// /api/v1 in app.js; the staff GET /donations… routes are separate.
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

module.exports = router;
