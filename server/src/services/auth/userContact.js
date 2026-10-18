const prisma = require("../../config/prisma");

// Who to email and how to greet them: the Users row plus the name and
// accountStatus from whichever role table the user is in. One query — every
// role relation is selected and only the user's own one comes back non-null.
// Shared by every email flow (verification, password reset, reactivation,
// notifications) so none of them re-derives the role → name-field mapping.
const ROLE_FIELDS = {
  Admin: { relation: "admin", nameField: "adminName" },
  Adopter: { relation: "adopter", nameField: "adopterName" },
  Donor: { relation: "donor", nameField: "donorName" },
  Staff: { relation: "staff", nameField: "staffName" },
  Veterinarian: { relation: "veterinarian", nameField: "vetName" },
  Volunteer: { relation: "volunteer", nameField: "volunteerName" },
};

const ROLE_SELECT = Object.fromEntries(
  Object.values(ROLE_FIELDS).map(({ relation, nameField }) => [
    relation,
    { select: { [nameField]: true, accountStatus: true } },
  ]),
);

// Returns { userID, email, role, emailVerified, name, accountStatus }, or null
// if there's no such user. Pass `db` to read inside a $transaction.
const getUserContact = async (userID, db = prisma) => {
  const user = await db.users.findUnique({
    where: { userID },
    select: { userID: true, userEmail: true, role: true, emailVerified: true, ...ROLE_SELECT },
  });
  if (!user) return null;

  const fields = ROLE_FIELDS[user.role];
  const roleRow = fields ? user[fields.relation] : null;
  return {
    userID: user.userID,
    email: user.userEmail,
    role: user.role,
    emailVerified: user.emailVerified,
    name: roleRow?.[fields.nameField] ?? null,
    accountStatus: roleRow?.accountStatus ?? null,
  };
};

module.exports = { getUserContact, ROLE_FIELDS };
