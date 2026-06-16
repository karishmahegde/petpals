//Why we need it: To authenticate the user's request by verifying the JWT token.
//How it works: It checks the JWT token in the request headers and verifies it. If the token is valid, it allows the request to proceed. If the token is invalid, it returns a 401 Unauthorized error.
//What it returns: A function that can be used as a middleware function in the Express app.
//How to use it: It can be used as a middleware function in the Express app.

const jwt = require("jsonwebtoken"); //importing the jsonwebtoken library

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization; //authorization header from incoming request

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      error: { code: "UNAUTHORIZED", details: "Invalid token format" },
    });
  }

  //Checking if the token is provided
  const token = authHeader && authHeader.split(" ")[1]; //token is the second part of the authorization header
  if (!token) {
    //if no token is provided, return a 401 Unauthorized error
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      error: { code: "UNAUTHORIZED", details: "No token provided" },
    });
  }

  //Verifying the token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); //verifying the token
    req.user = { userID: decoded.userID, role: decoded.role }; //attaching the decoded token to the request object
    next(); //proceeding to the next middleware
  } catch (error) {
    const details =
      error.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({
      success: false,
      message: "Authentication Falied",
      error: { code: "UNAUTHORIZED", details },
    });
  }
};

//Exporting the authenticate middleware
module.exports = authenticate;
