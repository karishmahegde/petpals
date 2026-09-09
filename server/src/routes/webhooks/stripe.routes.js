// Defines the /webhooks/stripe route — mounted at /api/v1/webhooks/stripe in
// app.js. Mounted with express.raw() BEFORE the app-wide express.json(),
// since Stripe's signature verification needs the untouched raw body.
const express = require("express");
const controller = require("../../controllers/webhooks/stripe.controller");
const router = express.Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  controller.handleWebhook,
);

module.exports = router;
