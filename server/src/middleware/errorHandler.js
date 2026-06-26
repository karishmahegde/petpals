const { ERROR_CODES } = require("../utils/errors");
const { errorResponse } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  console.log("Error code received:", err.code); // add this
  console.log("Error message:", err.message); // add this
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  const code =
    err.code && ERROR_CODES[err.code] ? err.code : "INTERNAL_SERVER_ERROR";
  const statusCode = ERROR_CODES[code];
  const message = err.message || "Internal server error";
  const details = err.details || null;

  return errorResponse(res, message, code, details, statusCode);
};

module.exports = errorHandler;
