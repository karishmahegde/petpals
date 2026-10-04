const donationsService = require("../../services/donor/donations.service");
const { successResponse, successListResponse } = require("../../utils/response");
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

const parseOptionalDate = (value, field) => {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
};

const parsePositiveInt = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return n;
};

// ——————————————— GET /donors/me/donations ———————————————
// One path, two uses (same as GET /adoption-applications): with
// ?checkoutSessionId= it's the confirmation page's poll for the donation the
// webhook records — data is that donation, or null while the webhook hasn't
// landed yet. Otherwise it's the donor's paginated history.
const listMyDonations = async (req, res, next) => {
  const { checkoutSessionId } = req.query;
  if (checkoutSessionId !== undefined) {
    if (typeof checkoutSessionId !== "string" || !checkoutSessionId) {
      return next(badRequest("checkoutSessionId must be a non-empty string"));
    }
    try {
      const donation = await donationsService.getMyDonationByCheckoutSession(
        req.user.userID,
        checkoutSessionId,
      );
      return successResponse(
        res,
        donation ? "Donation retrieved successfully" : "Donation not recorded yet",
        donation,
      );
    } catch (err) {
      return next(err);
    }
  }

  let shelterID;
  let dateFrom;
  let dateTo;
  let page = 1;
  let limit = 20;
  try {
    if (req.query.shelterID !== undefined) {
      shelterID = parsePositiveInt(req.query.shelterID, "shelterID");
    }
    dateFrom = parseOptionalDate(req.query.dateFrom, "dateFrom");
    dateTo = parseOptionalDate(req.query.dateTo, "dateTo");
    if (req.query.page !== undefined) {
      page = parsePositiveInt(req.query.page, "page");
    }
    if (req.query.limit !== undefined) {
      limit = parsePositiveInt(req.query.limit, "limit");
      if (limit > 100) throw badRequest("limit must be an integer between 1 and 100");
    }
  } catch (err) {
    return next(err);
  }

  try {
    const result = await donationsService.listMyDonations(req.user.userID, {
      shelterID,
      dateFrom,
      dateTo,
      page,
      limit,
    });
    return successListResponse(
      res,
      "Donations retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /donors/me/donations/stats ———————————————
// yearStart (required) is the client's local start of the year, so "this
// year" follows the donor's timezone — same idea as the staff stats'
// monthStart.
const getMyDonationStats = async (req, res, next) => {
  let yearStart;
  try {
    yearStart = parseOptionalDate(req.query.yearStart, "yearStart");
  } catch (err) {
    return next(err);
  }
  if (!yearStart) {
    return next(badRequest("yearStart is required and must be a valid date"));
  }

  try {
    const stats = await donationsService.getMyDonationStats(req.user.userID, { yearStart });
    return successResponse(res, "Donation stats retrieved successfully", stats);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /donors/me/donations/:id ———————————————
const getMyDonation = async (req, res, next) => {
  let donationID;
  try {
    donationID = parsePositiveInt(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const donation = await donationsService.getMyDonation(req.user.userID, donationID);
    return successResponse(res, "Donation retrieved successfully", donation);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createCheckout, listMyDonations, getMyDonationStats, getMyDonation };
