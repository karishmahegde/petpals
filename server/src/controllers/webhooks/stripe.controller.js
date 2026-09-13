const stripe = require("../../config/stripe");
const adoptionApplicationsService = require("../../services/adopter/adoptionApplications.service");

// ——————————————— POST /webhooks/stripe ———————————————
// req.body is the raw request Buffer here (see routes/webhooks/stripe.routes.js
// — this route is mounted with express.raw(), ahead of the app-wide
// express.json(), specifically so stripe.webhooks.constructEvent gets the
// untouched bytes it needs to verify the signature).
const handleWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error(`Stripe webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // Defensive check — checkout.session.completed can in principle fire
      // before funds settle for some payment methods; not expected for the
      // cards-only flow this project uses, but costs nothing to check.
      if (session.payment_status === "paid") {
        await adoptionApplicationsService.finalizeApplication(session);
      }
    }
    // Any other event type is ignored — 200 either way, so Stripe doesn't
    // retry events this endpoint has no handling for.
    return res.status(200).json({ received: true });
  } catch (err) {
    // A genuine processing failure (not the P2002 duplicate case, which
    // finalizeApplication already swallows) — return non-2xx so Stripe
    // retries the event.
    console.error("Stripe webhook processing error:", err);
    return res.status(500).json({ received: false });
  }
};

module.exports = { handleWebhook };
