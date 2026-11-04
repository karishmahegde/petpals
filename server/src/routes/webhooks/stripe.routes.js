// Defines the /webhooks/stripe route — mounted at /api/v1/webhooks/stripe in
// app.js. Mounted with express.raw() BEFORE the app-wide express.json(),
// since Stripe's signature verification needs the untouched raw body.
const express = require("express");
const controller = require("../../controllers/webhooks/stripe.controller");
const router = express.Router();

/**
 * @swagger
 * /webhooks/stripe:
 *   post:
 *     summary: Stripe's payment notifications (called by Stripe, not the client)
 *     description: >
 *       Stripe's webhook endpoint, set up in the Stripe dashboard for the
 *       checkout.session.completed event. The Stripe-Signature header is
 *       verified against STRIPE_WEBHOOK_SECRET using the untouched raw body, so
 *       a request not signed by Stripe is rejected with 400. A completed
 *       adoption-fee session creates the AdoptionApplication; one with
 *       metadata.kind = "donation" records the Donation. Both are idempotent on
 *       the Checkout Session ID, so a replayed event changes nothing. Any other
 *       event type is acknowledged with 200 and ignored, so Stripe doesn't retry
 *       it. Not callable from Swagger UI — the signature can't be produced here.
 *     tags: [Payments]
 *     parameters:
 *       - in: header
 *         name: Stripe-Signature
 *         required: true
 *         schema: { type: string }
 *         description: Stripe's signature of the raw body (t=…,v1=…)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: A Stripe Event object
 *             properties:
 *               id: { type: string, example: evt_1Q… }
 *               type: { type: string, example: checkout.session.completed }
 *               data:
 *                 type: object
 *                 properties:
 *                   object: { type: object, description: The Checkout Session }
 *     responses:
 *       200:
 *         description: Event received (processed, or ignored when not handled)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received: { type: boolean, example: true }
 *       400:
 *         description: Missing or invalid Stripe-Signature (plain text "Webhook Error …")
 */
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  controller.handleWebhook,
);

module.exports = router;
