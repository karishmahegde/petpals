const prisma = require("../../config/prisma");
const stripe = require("../../config/stripe");
const { isUniqueViolation } = require("../../utils/prismaErrors");

// Donations through Stripe Checkout — the same flow as the adoption
// application fee (adopter/adoptionApplications.service.js): POST
// /donations/checkout only creates a Checkout Session; the Donation row is
// created by the webhook once Stripe confirms payment (finalizeDonation).

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Tells the shared webhook (controllers/webhooks/stripe.controller.js) which
// flow a completed Checkout Session belongs to. Application-fee sessions
// carry no kind — the webhook treats "no kind" as an application.
const DONATION_KIND = "donation";

const notFound = (message) => {
  const err = new Error(message);
  err.code = "NOT_FOUND";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// The donor's Stripe Customer, created on first donation and reused after —
// same as the adopter's ensureStripeCustomer. stripeCustomerID is never
// returned by the API.
const ensureStripeCustomer = async (donorID) => {
  const donor = await prisma.donor.findUnique({
    where: { userID: donorID },
    select: {
      stripeCustomerID: true,
      donorName: true,
      user: { select: { userEmail: true } },
    },
  });
  if (!donor) {
    throw notFound("No donor record exists for this account");
  }
  if (donor.stripeCustomerID) {
    return donor.stripeCustomerID;
  }

  const customer = await stripe.customers.create({
    name: donor.donorName,
    email: donor.user.userEmail,
  });
  await prisma.donor.update({
    where: { userID: donorID },
    data: { stripeCustomerID: customer.id },
  });
  return customer.id;
};

// ——————————————— POST /donations/checkout ———————————————
// `amount` is whole US dollars, already bounds-checked by the controller.
// A Closed shelter can't take donations (409); Open and Full ones can — a
// Full shelter has no room for animals, which says nothing about money.
const createCheckoutSession = async ({ donorID, shelterID, amount, donationDesc }) => {
  const shelter = await prisma.shelter.findUnique({
    where: { shelterID },
    select: { shelterName: true, shelterStatus: true },
  });
  if (!shelter) {
    throw notFound(`No shelter exists with ID ${shelterID}`);
  }
  if (shelter.shelterStatus === "Closed") {
    throw conflict(`${shelter.shelterName} is closed and isn't accepting donations`);
  }

  const customerID = await ensureStripeCustomer(donorID);

  const session = await stripe.checkout.sessions.create({
    customer: customerID,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount * 100,
          product_data: { name: `Donation to ${shelter.shelterName}` },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: DONATION_KIND,
      donorID: String(donorID),
      shelterID: String(shelterID),
      donationDesc: donationDesc ?? "",
    },
    success_url: `${CLIENT_URL}/donor/donate/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${CLIENT_URL}/donor/donate`,
  });

  return { checkoutUrl: session.url };
};

// ——————————————— WEBHOOK (checkout.session.completed, kind = donation) ———————————————
// The amount recorded is what Stripe actually charged (amount_total, in
// cents) — never a client-supplied figure. Idempotent: Stripe can deliver
// the same event more than once, and stripeCheckoutSessionID is unique, so a
// replay hits the unique index and is ignored.
const finalizeDonation = async (session) => {
  const { donorID, shelterID, donationDesc } = session.metadata;

  try {
    await prisma.donation.create({
      data: {
        donorID: Number(donorID),
        shelterID: Number(shelterID),
        donationAmt: session.amount_total / 100,
        donationDesc: donationDesc || null,
        stripeCheckoutSessionID: session.id,
        stripePaymentIntentID: session.payment_intent || null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return; // already recorded — a replayed event
    }
    throw err;
  }
};

module.exports = {
  DONATION_KIND,
  ensureStripeCustomer,
  createCheckoutSession,
  finalizeDonation,
};
