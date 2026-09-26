const prisma = require("../../config/prisma");
const { staffStatusDates } = require("../../utils/staffDates");

// Shelter-level staff management for the shelter's manager (Management →
// Staff tab) — distinct from Admin's org-wide admin/staff.service.js. Every
// call is scoped to the one shelter whose managerStaffID is the caller.

const forbidden = (message) => {
  const err = new Error(message);
  err.code = "FORBIDDEN";
  return err;
};

const notFound = (userID) => {
  const err = new Error(`No staff member exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// Designations a manager may assign. Manager itself stays Admin-controlled
// (it also moves Shelter.managerStaffID — see admin/staff.service.js).
const ASSIGNABLE_DESIGNATIONS = ["Senior", "Associate"];

// Pending → Active (approve), Pending → Deactivated (decline),
// Active → Deactivated (deactivate).
const ALLOWED_TRANSITIONS = {
  Pending: ["Active", "Deactivated"],
  Active: ["Deactivated"],
};

const SHELTER_STAFF_SELECT = {
  userID: true,
  avatarSeed: true,
  staffName: true,
  staffPhone: true,
  staffDOB: true,
  staffSex: true,
  staffDesignation: true,
  staffDOJ: true,
  staffDOS: true,
  accountStatus: true,
  user: { select: { userEmail: true } },
};

const formatMember = (row) => ({
  userID: row.userID,
  avatarSeed: row.avatarSeed,
  staffName: row.staffName,
  staffEmail: row.user.userEmail,
  staffPhone: row.staffPhone,
  staffDOB: row.staffDOB,
  staffSex: row.staffSex,
  staffDesignation: row.staffDesignation,
  staffDOJ: row.staffDOJ,
  staffDOS: row.staffDOS,
  accountStatus: row.accountStatus,
});

// The shelter the caller manages — the gate for every endpoint here.
const resolveManagedShelterID = async (userID) => {
  const shelter = await prisma.shelter.findFirst({
    where: { managerStaffID: userID },
    select: { shelterID: true },
  });
  if (!shelter) {
    throw forbidden("Only a shelter's manager can manage its staff");
  }
  return shelter.shelterID;
};

// A colleague at the manager's shelter — never the manager themself.
const loadShelterStaffMember = async (managerID, targetID) => {
  const shelterID = await resolveManagedShelterID(managerID);
  if (targetID === managerID) {
    throw forbidden("You can't change your own account here");
  }
  const member = await prisma.staff.findUnique({
    where: { userID: targetID },
    select: {
      shelterID: true,
      staffDesignation: true,
      accountStatus: true,
      staffDOJ: true,
    },
  });
  if (!member) {
    throw notFound(targetID);
  }
  if (member.shelterID !== shelterID) {
    throw forbidden("You may only manage staff at your own shelter");
  }
  return member;
};

// ——————————————— LIST (GET /staff/me/team) ———————————————
// section "pending" = awaiting approval; "all" = everyone already approved
// (Active or Deactivated), the manager included.
const listShelterStaff = async (
  managerID,
  { section, staffDesignation, name, page = 1, limit = 20 },
) => {
  const shelterID = await resolveManagedShelterID(managerID);

  const where =
    section === "pending"
      ? // A Pending Manager sign-up is Admin's to approve, not a colleague's.
        {
          shelterID,
          accountStatus: "Pending",
          OR: [
            { staffDesignation: null },
            { staffDesignation: { not: "Manager" } },
          ],
        }
      : { shelterID, accountStatus: { in: ["Active", "Deactivated"] } };
  if (staffDesignation) where.staffDesignation = staffDesignation;
  if (name) where.staffName = { contains: name, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      select: SHELTER_STAFF_SELECT,
      orderBy: { staffName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.staff.count({ where }),
  ]);

  return {
    data: rows.map(formatMember),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— DESIGNATION (PATCH /staff/me/team/:id) ———————————————
const updateDesignation = async (managerID, targetID, staffDesignation) => {
  if (!ASSIGNABLE_DESIGNATIONS.includes(staffDesignation)) {
    throw badRequest(
      `staffDesignation must be one of: ${ASSIGNABLE_DESIGNATIONS.join(", ")}`,
    );
  }
  const member = await loadShelterStaffMember(managerID, targetID);
  if (member.accountStatus !== "Active") {
    throw conflict("Only an active staff member's designation can be changed");
  }
  if (member.staffDesignation === "Manager") {
    throw forbidden("A manager's designation is changed by an Admin");
  }

  const updated = await prisma.staff.update({
    where: { userID: targetID },
    data: { staffDesignation },
    select: SHELTER_STAFF_SELECT,
  });
  return formatMember(updated);
};

// ——————————————— STATUS (PATCH /staff/me/team/:id/status) ———————————————
// Approving (Pending → Active) is also when the manager sets the new
// member's designation — staff sign up with none — so staffDesignation
// (Senior/Associate) is required then. A Pending Manager sign-up is
// Admin's to approve, not the manager's.
const updateStatus = async (managerID, targetID, accountStatus, staffDesignation) => {
  const member = await loadShelterStaffMember(managerID, targetID);
  if (member.accountStatus === "Pending" && member.staffDesignation === "Manager") {
    throw forbidden("A Manager sign-up is approved by an Admin");
  }
  if (!ALLOWED_TRANSITIONS[member.accountStatus]?.includes(accountStatus)) {
    throw conflict(
      `A ${member.accountStatus} staff member can't be moved to ${accountStatus}`,
    );
  }

  const approving = member.accountStatus === "Pending" && accountStatus === "Active";
  if (approving && !ASSIGNABLE_DESIGNATIONS.includes(staffDesignation)) {
    throw badRequest(
      `staffDesignation is required when approving and must be one of: ${ASSIGNABLE_DESIGNATIONS.join(", ")}`,
    );
  }

  // Approving stamps staffDOJ; deactivating stamps staffDOS — see
  // utils/staffDates.js.
  const updated = await prisma.staff.update({
    where: { userID: targetID },
    data: {
      accountStatus,
      ...staffStatusDates(accountStatus, member),
      ...(approving ? { staffDesignation } : {}),
    },
    select: SHELTER_STAFF_SELECT,
  });
  return formatMember(updated);
};

module.exports = {
  listShelterStaff,
  updateDesignation,
  updateStatus,
  resolveManagedShelterID, // also gates staff/vets.service.js
};
