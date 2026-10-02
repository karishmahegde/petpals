const prisma = require("../../config/prisma");
const { resolveManagedShelterID } = require("./shelterStaff.service");
const {
  withGovernmentIdStatus,
  assertReadyForApproval,
} = require("./staffApproval.service");
const { ADDRESS_SELECT } = require("../../utils/address");

// The shelter manager's vet roster (Staff dashboard → Management → Vets) —
// same shape of rules as shelterStaff.service.js's staff roster: every call is
// scoped to the one shelter whose managerStaffID is the caller (403
// otherwise). Vets pick that shelter at sign-up and start Pending until its
// manager approves them — which, as for staff, needs their onboarding
// complete and their government ID Verified (staffApproval.service.js).

const forbidden = (message) => {
  const err = new Error(message);
  err.code = "FORBIDDEN";
  return err;
};

const notFound = (userID) => {
  const err = new Error(`No veterinarian exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// Pending → Active (approve) / Deactivated (decline); Active → Deactivated.
// Reactivation stays Admin-side, same as for staff.
const ALLOWED_TRANSITIONS = {
  Pending: ["Active", "Deactivated"],
  Active: ["Deactivated"],
};

const VET_SELECT = {
  userID: true,
  avatarSeed: true,
  vetName: true,
  vetPhone: true,
  ...ADDRESS_SELECT,
  vetDOB: true,
  vetSex: true,
  createdAt: true,
  accountStatus: true,
  onboardingComplete: true,
  user: { select: { userEmail: true } },
};

const formatVet = (row) => ({
  userID: row.userID,
  avatarSeed: row.avatarSeed,
  vetName: row.vetName,
  vetEmail: row.user.userEmail,
  vetPhone: row.vetPhone,
  addressLine1: row.addressLine1,
  addressLine2: row.addressLine2,
  city: row.city,
  state: row.state,
  zip: row.zip,
  country: row.country,
  vetDOB: row.vetDOB,
  vetSex: row.vetSex,
  createdAt: row.createdAt,
  accountStatus: row.accountStatus,
  // What the manager needs to see before approving — see
  // staffApproval.service.js.
  onboardingComplete: row.onboardingComplete,
  governmentIdStatus: row.governmentIdStatus,
});

// `row` already carries governmentIdStatus (see withGovernmentIdStatus).
const formatOne = async (row) =>
  formatVet((await withGovernmentIdStatus("Veterinarian", [row]))[0]);

// ——————————————— LIST (GET /staff/me/vets) ———————————————
// section "pending" = awaiting approval; "all" = already approved (Active or
// Deactivated), optionally narrowed by accountStatus.
const listVets = async (
  managerID,
  { section, accountStatus, name, page = 1, limit = 20 },
) => {
  const shelterID = await resolveManagedShelterID(managerID);

  const where = {
    shelterID,
    accountStatus:
      section === "pending"
        ? "Pending"
        : (accountStatus ?? { in: ["Active", "Deactivated"] }),
  };
  if (name) where.vetName = { contains: name, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.veterinarian.findMany({
      where,
      select: VET_SELECT,
      orderBy: { vetName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.veterinarian.count({ where }),
  ]);

  return {
    data: (await withGovernmentIdStatus("Veterinarian", rows)).map(formatVet),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— STATUS (PATCH /staff/me/vets/:id/status) ———————————————
const updateVetStatus = async (managerID, vetID, accountStatus) => {
  const shelterID = await resolveManagedShelterID(managerID);

  const vet = await prisma.veterinarian.findUnique({
    where: { userID: vetID },
    select: { shelterID: true, accountStatus: true, onboardingComplete: true },
  });
  if (!vet) {
    throw notFound(vetID);
  }
  if (vet.shelterID !== shelterID) {
    throw forbidden("You may only manage veterinarians at your own shelter");
  }
  if (!ALLOWED_TRANSITIONS[vet.accountStatus]?.includes(accountStatus)) {
    throw conflict(
      `A ${vet.accountStatus} veterinarian can't be moved to ${accountStatus}`,
    );
  }
  // Only approving is gated — declining (Pending → Deactivated) is allowed
  // at any onboarding stage.
  if (vet.accountStatus === "Pending" && accountStatus === "Active") {
    await assertReadyForApproval("Veterinarian", vetID, vet.onboardingComplete);
  }

  const updated = await prisma.veterinarian.update({
    where: { userID: vetID },
    data: { accountStatus },
    select: VET_SELECT,
  });
  return formatOne(updated);
};

module.exports = { listVets, updateVetStatus };
