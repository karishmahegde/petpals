const donationsService = require("../../services/staff/donations.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseOptionalDate = (value, field) => {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
};

// Only meaningful for Admin — a Staff caller's shelter is always their own,
// resolved server-side in the service, never from a query param.
const parseAdminShelterID = (req) => {
  if (req.user.role !== "Admin" || req.query.shelterID === undefined) return undefined;
  const shelterID = Number(req.query.shelterID);
  if (!Number.isInteger(shelterID) || shelterID < 1) {
    throw badRequest("shelterID must be a positive integer");
  }
  return shelterID;
};

// ——————————————— GET /donations ———————————————
const listDonations = async (req, res, next) => {
  const { donorName, page: pageRaw, limit: limitRaw } = req.query;

  let dateFrom;
  let dateTo;
  let shelterID;
  try {
    dateFrom = parseOptionalDate(req.query.dateFrom, "dateFrom");
    dateTo = parseOptionalDate(req.query.dateTo, "dateTo");
    shelterID = parseAdminShelterID(req);
  } catch (err) {
    return next(err);
  }

  let page = 1;
  if (pageRaw !== undefined) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return next(badRequest("page must be an integer >= 1"));
    }
  }

  let limit = 20;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return next(badRequest("limit must be an integer between 1 and 100"));
    }
  }

  try {
    const result = await donationsService.listDonations(
      { role: req.user.role, userID: req.user.userID },
      {
        dateFrom,
        dateTo,
        donorName: typeof donorName === "string" ? donorName.trim() : undefined,
        shelterID,
        page,
        limit,
      },
    );
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

// ——————————————— GET /donations/stats ———————————————
const getDonationStats = async (req, res, next) => {
  let monthStart;
  let shelterID;
  try {
    monthStart = parseOptionalDate(req.query.monthStart, "monthStart");
    shelterID = parseAdminShelterID(req);
  } catch (err) {
    return next(err);
  }
  if (!monthStart) {
    return next(badRequest("monthStart is required and must be a valid date"));
  }

  try {
    const stats = await donationsService.getDonationStats(
      { role: req.user.role, userID: req.user.userID },
      { monthStart, shelterID },
    );
    return successResponse(res, "Donation stats retrieved successfully", stats);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /donations/:id ———————————————
const getDonation = async (req, res, next) => {
  const donationID = Number(req.params.id);
  if (!Number.isInteger(donationID) || donationID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const donation = await donationsService.getDonationDetail(donationID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Donation retrieved successfully", donation);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listDonations, getDonationStats, getDonation };
