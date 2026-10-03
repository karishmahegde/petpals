const donationsService = require("../../services/donor/donations.service");
const { successResponse } = require("../../utils/response");
const { DONATION_MIN_USD, DONATION_MAX_USD } = require("../../config/fees");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const MAX_DESC_LEN = 300; // schema.prisma: Donation.donationDesc is VarChar(300)

// ——————————————— POST /donations/checkout ———————————————
// Body { shelterID, amount (whole dollars), donationDesc? } → a Stripe
// Checkout URL. Nothing is recorded until the webhook confirms payment.
const createCheckout = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const shelterID = Number(body.shelterID);
  if (!Number.isInteger(shelterID) || shelterID < 1) {
    return next(badRequest("shelterID is required and must be a positive integer"));
  }

  const amount = body.amount;
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < DONATION_MIN_USD ||
    amount > DONATION_MAX_USD
  ) {
    return next(
      badRequest(
        `amount must be a whole number of dollars between ${DONATION_MIN_USD} and ${DONATION_MAX_USD}`,
      ),
    );
  }

  let donationDesc = null;
  if (body.donationDesc !== undefined && body.donationDesc !== null) {
    if (typeof body.donationDesc !== "string" || body.donationDesc.length > MAX_DESC_LEN) {
      return next(
        badRequest(`donationDesc must be a string of at most ${MAX_DESC_LEN} characters`),
      );
    }
    donationDesc = body.donationDesc.trim() || null;
  }

  try {
    const { checkoutUrl } = await donationsService.createCheckoutSession({
      donorID: req.user.userID,
      shelterID,
      amount,
      donationDesc,
    });
    return successResponse(res, "Checkout session created successfully", { checkoutUrl }, 201);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createCheckout };
