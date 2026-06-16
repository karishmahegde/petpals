//Why we need it: To authorize the user's request by checking if the user has the required role.
//How it works: It checks if the user has the required role. If the user has the required role, it allows the request to proceed. If the user does not have the required role, it returns a 403 Forbidden error.
//What it returns: A function that can be used as a middleware function in the Express app.
//How to use it: It can be used as a middleware function in the Express app.

//Defining the roles
const ROLES = {
  ADMIN: "Admin",
  STAFF: "Staff",
  ADOPTER: "Adopter",
  VETERINARIAN: "Veterinarian",
  VOLUNTEER: "Volunteer",
  DONOR: "Donor",
};

//This will check the role of the request user and check if it's present in the authorizeRoles factory function
//Example: Only Admin and Staff can access this: router.get('/applications', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), getApplications);
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        error: {
          code: "FORBIDDEN",
          details: `Role '${req.user?.role ?? "unknown"}' is not permitted to access this resource`,
        },
      });
    }
    next();
  };
};

module.exports = { authorizeRoles, ROLES };
