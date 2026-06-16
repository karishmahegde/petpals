//Why we need it: To define the error codes for the API.
//How it works: It defines the error codes for the API.
//What it returns: An object with the error codes.
//How to use it: It can be used to return the error codes in the API.
//single ERROR_CODES object mapping all 7 error codes to their HTTP status numbers. Import this anywhere you need to throw a structured error or look up a status.
const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
};

module.exports = { ERROR_CODES };
