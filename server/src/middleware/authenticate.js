//Why we need it: To authenticate the user's request by verifying the JWT token.
//How it works: It checks the JWT token in the request headers and verifies it. If the token is valid, it allows the request to proceed. If the token is invalid, it returns a 401 Unauthorized error.
//What it returns: A function that can be used as a middleware function in the Express app.
//How to use it: It can be used as a middleware function in the Express app.

const jwt = require("jsonwebtoken");
const { getAccountStatus } = require("../services/auth/auth.service");

// A 15-minute access token otherwise stays valid for its whole life no
// matter what happens to the account after it was issued — login() only
// blocks a *fresh* login. Checking accountStatus here (one indexed lookup
// per request, on the role table's PK) closes that gap so a deactivated,
// banned, or deleted account's still-unexpired token stops working right
// away, on every protected route across every role, not just at the next
// login/refresh. Same statuses login() itself rejects, plus "DELETED" — the
// sentinel getAccountStatus returns when the role row is gone entirely.
const BLOCKED_STATUSES = ["Deactivated", "Banned", "Pending", "DELETED"];

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

    const accountStatus = await getAccountStatus(decoded.userID, decoded.role);
    if (BLOCKED_STATUSES.includes(accountStatus)) {
      return res.status(401).json({
        success: false,
        message: "This account is no longer active",
        error: {
          code: "UNAUTHORIZED",
          details: "Account deactivated, banned, or deleted",
        },
      });
    }

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
