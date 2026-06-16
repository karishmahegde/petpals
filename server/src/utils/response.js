//Why we need it: To return the response to the client.
//How it works: It returns the response to the client.
//What it returns: A function that can be used to return the response to the client.
//How to use it: It can be used to return the response to the client.

//Success response: single record
const successResponse = (res, message, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

//Success list response: multiple records
const successListResponse = (
  res,
  message,
  data,
  pagination,
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
};

//Error response: error response
const errorResponse = (res, message, code, details, statusCode) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code, details },
  });
};

module.exports = { successResponse, successListResponse, errorResponse };
