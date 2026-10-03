// Roles whose Pending accounts CAN log in — to onboard (profile, address,
// government ID) before their shelter manager approves them. Shared by
// auth.service.js (login lets them in, sessions carry accountStatus) and
// middleware/authenticate.js (authenticate.allowPending admits them on the
// few onboarding routes), so the two can't drift apart. Kept in its own
// module rather than auth.service.js because authenticate's unit test mocks
// that whole service. Pending Volunteer/Admin accounts stay blocked.
const PENDING_LOGIN_ROLES = new Set(["Staff", "Veterinarian"]);

module.exports = { PENDING_LOGIN_ROLES };
