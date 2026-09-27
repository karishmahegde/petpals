const prisma = require("../../config/prisma");

// A Pending staff member can only be approved (Pending → Active) once they've
// finished onboarding AND their government ID has been Verified — the
// approver should know exactly who they're granting access to adopters'
// personal data. Shared by both approval paths (a Manager's
// PATCH /staff/me/team/:id/status and Admin's PATCH /staff/:id/status for
// Manager sign-ups) so the rule can't drift between them. Declining
// (Pending → Deactivated) never needs it.

// userID → verificationStatus of their Staff government ID (one per user —
// GovernmentID's @@unique([userID, userType])).
const governmentIdStatuses = async (userIDs) => {
  if (userIDs.length === 0) return new Map();
  const rows = await prisma.governmentID.findMany({
    where: { userID: { in: userIDs }, userType: "Staff" },
    select: { userID: true, verificationStatus: true },
  });
  return new Map(rows.map((row) => [row.userID, row.verificationStatus]));
};

// Adds governmentIdStatus (Pending/Verified/Rejected, or null when none has
// been submitted) to each staff row — one query for the whole list. Only
// the status is exposed, never the idType/idNumber/document (CLAUDE.md's
// "never expose governmentID" rule); reviewing the document itself happens
// in the ID Verification tab.
const withGovernmentIdStatus = async (rows) => {
  const statuses = await governmentIdStatuses(rows.map((row) => row.userID));
  return rows.map((row) => ({
    ...row,
    governmentIdStatus: statuses.get(row.userID) ?? null,
  }));
};

// Throws CONFLICT naming everything still missing. `onboardingComplete` is
// passed in since both callers have already loaded the staff row.
const assertReadyForApproval = async (userID, onboardingComplete) => {
  const reasons = [];
  if (!onboardingComplete) {
    reasons.push("they haven't finished onboarding");
  }
  const idStatus = (await governmentIdStatuses([userID])).get(userID) ?? null;
  if (idStatus === null) {
    reasons.push("they haven't submitted a government ID");
  } else if (idStatus !== "Verified") {
    reasons.push(`their government ID is ${idStatus}, not Verified`);
  }

  if (reasons.length > 0) {
    const err = new Error(
      `This staff member can't be approved yet — ${reasons.join(" and ")}`,
    );
    err.code = "CONFLICT";
    throw err;
  }
};

module.exports = { withGovernmentIdStatus, assertReadyForApproval };
