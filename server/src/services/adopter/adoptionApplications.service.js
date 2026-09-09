const prisma = require("../../config/prisma");
const stripe = require("../../config/stripe");
const { APPLICATION_FEE_CENTS, APPLICATION_FEE_USD } = require("../../config/fees");
const { isUniqueViolation } = require("../../utils/prismaErrors");

// Scalar shape returned to the client for an application. Stripe reference
// IDs (session/payment intent) are deliberately excluded — no adopter-facing
// use for them, same "don't expose what isn't needed" posture as
// stripeCustomerID.
const APPLICATION_SELECT = {
  applicationID: true,
  petID: true,
  adopterID: true,
  shelterID: true,
  staffID: true,
  applicationStatus: true,
  applicationType: true,
  shelterMessage: true,
  paymentStatus: true,
  amountPaid: true,
  createdAt: true,
};

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Statuses that mean an application is still in play — a new one cannot be
// submitted for the same pet while one of these exists. A Rejected application
// does not block re-applying.
const ACTIVE_STATUSES = ["Pending", "Accepted"];

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// Prisma returns Decimal-typed fields as Decimal.js objects, which don't
// serialize to plain JSON numbers on their own — convert explicitly
// wherever amountPaid leaves this file.
const toClientShape = (application) =>
  application && {
    ...application,
    amountPaid: Number(application.amountPaid),
  };

// ——————————————— ELIGIBILITY CHECK (shared by checkout-session creation) ———————————————
// The same pet-exists/available/shelterID-matches/no-active-duplicate
// checks the old synchronous createApplication used to run inline — factored
// out so we fail fast, before charging the fee, for an application that
// would be rejected anyway.
const validateApplicationEligibility = async ({ adopterID, petID, shelterID }) => {
  const pet = await prisma.pet.findUnique({
    where: { petID },
    select: { petID: true, adoptionStatus: true, shelterID: true },
  });

  if (!pet) {
    const err = new Error(`No pet exists with ID ${petID}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  if (pet.adoptionStatus !== "available") {
    throw conflict("This pet is not currently available for adoption");
  }

  if (pet.shelterID !== shelterID) {
    const err = new Error("shelterID does not match the pet's shelter");
    err.code = "BAD_REQUEST";
    throw err;
  }

  // Fast path only — the real guarantee is the DB partial unique index on
  // (adopterID, petID) WHERE applicationStatus IN ('Pending','Accepted'),
  // caught as a unique violation in finalizeApplication() below.
  const existing = await prisma.adoptionApplication.findFirst({
    where: { adopterID, petID, applicationStatus: { in: ACTIVE_STATUSES } },
    select: { applicationID: true },
  });
  if (existing) {
    throw conflict("You already have an active application for this pet");
  }
};

// ——————————————— ENSURE STRIPE CUSTOMER ———————————————
// Mirrors the (currently unpopulated) Donor.stripeCustomerID pattern —
// this is the feature that actually wires Adopter.stripeCustomerID up.
const ensureStripeCustomer = async (adopterID) => {
  const adopter = await prisma.adopter.findUnique({
    where: { userID: adopterID },
    select: {
      stripeCustomerID: true,
      adopterName: true,
      user: { select: { userEmail: true } },
    },
  });

  if (!adopter) {
    const err = new Error(`No adopter exists with ID ${adopterID}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  if (adopter.stripeCustomerID) {
    return adopter.stripeCustomerID;
  }

  const customer = await stripe.customers.create({
    name: adopter.adopterName,
    email: adopter.user.userEmail,
  });

  await prisma.adopter.update({
    where: { userID: adopterID },
    data: { stripeCustomerID: customer.id },
  });

  return customer.id;
};

// ——————————————— CREATE CHECKOUT SESSION (POST /adoption-applications) ———————————————
// Replaces the old direct row-creation — the row itself is only ever
// created by the webhook once payment is confirmed (see finalizeApplication
// below). Form data survives the Stripe redirect round trip via metadata,
// since no DB row exists yet at this point.
const createCheckoutSession = async ({
  adopterID,
  petID,
  shelterID,
  applicationType,
  shelterMessage,
}) => {
  await validateApplicationEligibility({ adopterID, petID, shelterID });
  const customerID = await ensureStripeCustomer(adopterID);

  const session = await stripe.checkout.sessions.create({
    customer: customerID,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: APPLICATION_FEE_CENTS,
          product_data: { name: "Application Processing Fee" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      petID: String(petID),
      adopterID: String(adopterID),
      shelterID: String(shelterID),
      applicationType,
      shelterMessage: shelterMessage ?? "",
    },
    success_url: `${CLIENT_URL}/adopt/apply/${petID}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${CLIENT_URL}/adopt/apply/${petID}`,
  });

  return { checkoutUrl: session.url };
};

// ——————————————— FINALIZE APPLICATION (Stripe webhook only) ———————————————
// The only place an AdoptionApplication row is ever created. Called from
// the checkout.session.completed handler after signature verification.
const finalizeApplication = async (session) => {
  const { petID, adopterID, shelterID, applicationType, shelterMessage } =
    session.metadata;

  try {
    await prisma.adoptionApplication.create({
      data: {
        petID: Number(petID),
        adopterID: Number(adopterID),
        shelterID: Number(shelterID),
        applicationType,
        shelterMessage: shelterMessage || null,
        applicationStatus: "Pending",
        paymentStatus: "Paid",
        stripeCheckoutSessionID: session.id,
        stripePaymentIntentID: session.payment_intent || null,
        amountPaid: APPLICATION_FEE_USD,
      },
    });
  } catch (err) {
    // A duplicate active application slipping through a race condition —
    // the fee was charged (non-refundable, see spec) but no second row is
    // created. Logged for manual follow-up, not retried — Stripe still
    // gets its 200 from the caller.
    if (isUniqueViolation(err)) {
      console.error(
        `finalizeApplication: duplicate active application for adopter ${adopterID}, pet ${petID} (session ${session.id}) — payment captured, row not created`,
      );
      return;
    }
    throw err;
  }
};

// ——————————————— GET APPLICATION BY CHECKOUT SESSION (confirmation-page polling) ———————————————
// Not a thrown 404 — "not found yet" is the expected, common answer while
// the webhook is still in flight, not an error condition.
const getApplicationByCheckoutSession = async (adopterID, sessionId) => {
  const application = await prisma.adoptionApplication.findFirst({
    where: { adopterID, stripeCheckoutSessionID: sessionId },
    select: {
      ...APPLICATION_SELECT,
      pet: { select: { petName: true } },
    },
  });

  return toClientShape(application);
};

// ——————————————— GET APPLICATION BY ID (GET /adoption-applications/:id) ———————————————
const getApplicationById = async (applicationID, user) => {
  const application = await prisma.adoptionApplication.findUnique({
    where: { applicationID },
    select: {
      ...APPLICATION_SELECT,
      pet: { select: { petName: true } },
      shelter: { select: { shelterName: true } },
    },
  });

  if (!application) {
    const err = new Error(
      `No adoption application exists with ID ${applicationID}`,
    );
    err.code = "NOT_FOUND";
    throw err;
  }

  // Adopters may only see their own applications. Staff may see any.
  if (user.role === "Adopter" && application.adopterID !== user.userID) {
    const err = new Error("You can only view your own adoption applications");
    err.code = "FORBIDDEN";
    throw err;
  }

  return toClientShape(application);
};

// ——————————————— LIST APPLICATIONS FOR AN ADOPTER (GET /adopters/me/applications) ———————————————
const LIST_SELECT = {
  applicationID: true,
  petID: true,
  shelterID: true,
  applicationStatus: true,
  createdAt: true,
  pet: { select: { petName: true, petPhoto: true } },
  shelter: { select: { shelterName: true } },
};

const listApplicationsByAdopter = async (
  adopterID,
  { status, petID, page = 1, limit = 20 } = {},
) => {
  const where = { adopterID };
  if (status) {
    where.applicationStatus = status;
  }
  if (petID !== undefined) {
    where.petID = petID;
  }

  const [data, total] = await Promise.all([
    prisma.adoptionApplication.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adoptionApplication.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— LIST ADOPTED PETS (GET /adopters/me/adopted-pets) ———————————————
// Pets the adopter successfully adopted: their application was Accepted AND the
// pet's own status is now 'adopted'. There's no explicit adoption-completed
// timestamp, so "most recently adopted first" is approximated by the accepted
// application's createdAt.
const listAdoptedPetsByAdopter = async (adopterID) => {
  const rows = await prisma.adoptionApplication.findMany({
    where: {
      adopterID,
      applicationStatus: "Accepted",
      pet: { adoptionStatus: "adopted" },
    },
    select: {
      createdAt: true,
      pet: {
        select: {
          petID: true,
          petName: true,
          petPhoto: true,
          intakeDate: true,
          breed: {
            select: {
              breedName: true,
              species: { select: { speciesName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    petID: row.pet.petID,
    petName: row.pet.petName,
    petPhoto: row.pet.petPhoto,
    breed: row.pet.breed.breedName,
    species: row.pet.breed.species.speciesName,
    intakeDate: row.pet.intakeDate,
  }));
};

module.exports = {
  validateApplicationEligibility,
  ensureStripeCustomer,
  createCheckoutSession,
  finalizeApplication,
  getApplicationByCheckoutSession,
  getApplicationById,
  listApplicationsByAdopter,
  listAdoptedPetsByAdopter,
};
