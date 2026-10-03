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

// ——————————————— DONATION HISTORY (GET /donors/me/donations[/:id], /stats) ———————————————
// Always scoped to the caller's own donations (donorID). Never the Stripe
// IDs — the donor sees what they gave, where and when, by donationCode.
const DONATION_SELECT = {
  donationID: true,
  donationCode: true,
  donationDate: true,
  donationAmt: true,
  donationDesc: true,
  shelter: { select: { shelterID: true, shelterName: true } },
};

// Newest first. shelterID narrows to one shelter; dateFrom/dateTo
// (client-computed, so "this year" follows the donor's timezone) bound
// donationDate — dateFrom inclusive, dateTo exclusive, same as the staff
// GET /donations.
const listMyDonations = async (
  donorID,
  { shelterID, dateFrom, dateTo, page = 1, limit = 20 } = {},
) => {
  const where = { donorID };
  if (shelterID !== undefined) where.shelterID = shelterID;
  if (dateFrom || dateTo) {
    where.donationDate = {
      ...(dateFrom && { gte: dateFrom }),
      ...(dateTo && { lt: dateTo }),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      select: DONATION_SELECT,
      orderBy: { donationDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.donation.count({ where }),
  ]);

  return {
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Another donor's donation answers exactly like a missing one (404).
const getMyDonation = async (donorID, donationID) => {
  const donation = await prisma.donation.findFirst({
    where: { donationID, donorID },
    select: DONATION_SELECT,
  });
  if (!donation) {
    throw notFound(`No donation exists with ID ${donationID}`);
  }
  return donation;
};

// The post-payment confirmation page polls this until the webhook has
// recorded the donation. Not a thrown 404 — "not recorded yet" is the
// expected answer while the webhook is still in flight (same as the
// adoption confirmation's getApplicationByCheckoutSession).
const getMyDonationByCheckoutSession = (donorID, sessionId) =>
  prisma.donation.findFirst({
    where: { donorID, stripeCheckoutSessionID: sessionId },
    select: DONATION_SELECT,
  });

// Totals over ALL of the donor's donations (not the list's filters).
// yearStart is the client's local start of the year. byShelter is largest
// total first.
const getMyDonationStats = async (donorID, { yearStart }) => {
  const where = { donorID };
  const [all, thisYear, grouped] = await Promise.all([
    prisma.donation.aggregate({ where, _sum: { donationAmt: true }, _count: { _all: true } }),
    prisma.donation.aggregate({
      where: { ...where, donationDate: { gte: yearStart } },
      _sum: { donationAmt: true },
    }),
    prisma.donation.groupBy({
      by: ["shelterID"],
      where,
      _sum: { donationAmt: true },
      _count: { _all: true },
    }),
  ]);

  const shelters = grouped.length
    ? await prisma.shelter.findMany({
        where: { shelterID: { in: grouped.map((g) => g.shelterID) } },
        select: { shelterID: true, shelterName: true },
      })
    : [];
  const names = new Map(shelters.map((s) => [s.shelterID, s.shelterName]));

  return {
    totalAmount: all._sum.donationAmt ?? 0,
    donationCount: all._count._all,
    thisYearAmount: thisYear._sum.donationAmt ?? 0,
    byShelter: grouped
      .map((g) => ({
        shelterID: g.shelterID,
        shelterName: names.get(g.shelterID) ?? null,
        totalAmount: g._sum.donationAmt ?? 0,
        donationCount: g._count._all,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount),
  };
};

module.exports = {
  DONATION_KIND,
  ensureStripeCustomer,
  createCheckoutSession,
  finalizeDonation,
  listMyDonations,
  getMyDonation,
  getMyDonationByCheckoutSession,
  getMyDonationStats,
};
