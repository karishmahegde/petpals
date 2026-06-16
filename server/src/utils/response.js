const successResponse = (res, message, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const successListResponse = (res, message, data, pagination, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
};

const errorResponse = (res, message, code, details, statusCode) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code, details },
  });
};

module.exports = { successResponse, successListResponse, errorResponse };
