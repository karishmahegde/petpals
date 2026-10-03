const prisma = require("../../config/prisma");

// A Pending staff member or veterinarian can only be approved (Pending →
// Active) once they've finished onboarding AND their government ID has been
// Verified — the approver should know exactly who they're granting access to
// adopters' personal data and animals' medical records. Shared by every
// approval path (a Manager's PATCH /staff/me/team/:id/status and
// PATCH /staff/me/vets/:id/status, and Admin's PATCH /staff/:id/status for
// Manager sign-ups) so the rule can't drift between them. Declining
// (Pending → Deactivated) never needs it.
//
// Every export takes the GovernmentID userType of the people involved.

// Noun used in the CONFLICT message, by userType.
const NOUNS = { Staff: "staff member", Veterinarian: "veterinarian" };

// userID → verificationStatus of their government ID of this userType (one
// per user — GovernmentID's @@unique([userID, userType])).
const governmentIdStatuses = async (userType, userIDs) => {
  if (userIDs.length === 0) return new Map();
  const rows = await prisma.governmentID.findMany({
    where: { userID: { in: userIDs }, userType },
    select: { userID: true, verificationStatus: true },
  });
  return new Map(rows.map((row) => [row.userID, row.verificationStatus]));
};

// Adds governmentIdStatus (Pending/Verified/Rejected, or null when none has
// been submitted) to each row — one query for the whole list. Only
// the status is exposed, never the idType/idNumber/document (CLAUDE.md's
// "never expose governmentID" rule); reviewing the document itself happens
// in the ID Verification tab.
const withGovernmentIdStatus = async (userType, rows) => {
  const statuses = await governmentIdStatuses(
    userType,
    rows.map((row) => row.userID),
  );
  return rows.map((row) => ({
    ...row,
    governmentIdStatus: statuses.get(row.userID) ?? null,
  }));
};

// Throws CONFLICT naming everything still missing. `onboardingComplete` is
// passed in since every caller has already loaded the person's row.
const assertReadyForApproval = async (userType, userID, onboardingComplete) => {
  const reasons = [];
  if (!onboardingComplete) {
    reasons.push("they haven't finished onboarding");
  }
  const idStatus =
    (await governmentIdStatuses(userType, [userID])).get(userID) ?? null;
  if (idStatus === null) {
    reasons.push("they haven't submitted a government ID");
  } else if (idStatus !== "Verified") {
    reasons.push(`their government ID is ${idStatus}, not Verified`);
  }

  if (reasons.length > 0) {
    const err = new Error(
      `This ${NOUNS[userType]} can't be approved yet — ${reasons.join(" and ")}`,
    );
    err.code = "CONFLICT";
    throw err;
  }
};

module.exports = { withGovernmentIdStatus, assertReadyForApproval };
