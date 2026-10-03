const healthRecordsService = require("../../services/vet/healthRecords.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseId = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return n;
};

const MAX_DESC_LEN = 500; // schema.prisma: HealthRecord.recordDesc is VarChar(500)

const parseRecordDesc = (body) => {
  const raw = body && typeof body === "object" ? body.recordDesc : undefined;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.length > MAX_DESC_LEN) {
    throw badRequest(
      `recordDesc is required and must be at most ${MAX_DESC_LEN} characters`,
    );
  }
  return value;
};

// ——————————————— POST /pets/:id/health-records ———————————————
const createHealthRecord = async (req, res, next) => {
  try {
    const petID = parseId(req.params.id, "id");
    const recordDesc = parseRecordDesc(req.body);
    const record = await healthRecordsService.createHealthRecord(
      req.user.userID,
      petID,
      recordDesc,
    );
    return successResponse(res, "Health record created successfully", record, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PUT /health-records/:id ———————————————
const updateHealthRecord = async (req, res, next) => {
  try {
    const recordID = parseId(req.params.id, "id");
    const recordDesc = parseRecordDesc(req.body);
    const record = await healthRecordsService.updateHealthRecord(
      req.user.userID,
      recordID,
      recordDesc,
    );
    return successResponse(res, "Health record updated successfully", record);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createHealthRecord, updateHealthRecord };
