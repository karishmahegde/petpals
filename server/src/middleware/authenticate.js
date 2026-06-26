//Why we need it: To authenticate the user's request by verifying the JWT token.
//How it works: It checks the JWT token in the request headers and verifies it. If the token is valid, it allows the request to proceed. If the token is invalid, it returns a 401 Unauthorized error.
//What it returns: A function that can be used as a middleware function in the Express app.
//How to use it: It can be used as a middleware function in the Express app.

const jwt = require("jsonwebtoken");

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Check if acessToken is available
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      error: { code: "UNAUTHORIZED", details: "No token provided" },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verfify accessToken

    req.user = { userID: decoded.userID, role: decoded.role };
    next(); // This moves it to the next function in line at the parent level, which would be the controller
  } catch (error) {
    const details =
      error.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: { code: "UNAUTHORIZED", details },
    });
  }
};

//Exporting the authenticate middleware
module.exports = authenticate;
