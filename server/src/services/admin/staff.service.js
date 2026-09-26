const prisma = require("../../config/prisma");
const { staffStatusDates } = require("../../utils/staffDates");

// Every field lives on STAFF itself except shelterName and userEmail — the
// `user` relation is scoped to userEmail alone, so nothing else from USERS
// (userPassword, refreshToken) can leak here even by accident. Email matters
// here specifically for reviewing a Pending (self-registered, not yet
// assigned a shelter/designation) staff member — it may be the only
// identifying detail on the row besides their name.
const STAFF_LIST_SELECT = {
  userID: true,
  avatarSeed: true,
  staffName: true,
  staffPhone: true,
  shelterID: true,
  staffDOB: true,
  staffSex: true,
  staffDOJ: true,
  staffDOS: true,
  staffDesignation: true,
  accountStatus: true,
  shelter: { select: { shelterName: true } },
  user: { select: { userEmail: true } },
};

// ——————————————— LIST STAFF (GET /staff) ———————————————
// awaitingAdmin narrows to the Pending registrations Admin approves — Manager
// sign-ups only (the first staff sign-up at a shelter without one); every
// other staff member is approved by their shelter's manager.
const listStaff = async ({
  shelterID,
  staffDesignation,
  accountStatus,
  awaitingAdmin = false,
  name,
  page = 1,
  limit = 20,
} = {}) => {
  const where = awaitingAdmin
    ? { accountStatus: "Pending", staffDesignation: "Manager" }
    : {};
  if (shelterID !== undefined) where.shelterID = shelterID;
  if (staffDesignation !== undefined) where.staffDesignation = staffDesignation;
  if (accountStatus !== undefined && !awaitingAdmin) where.accountStatus = accountStatus;
  if (name) where.staffName = { contains: name, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      select: STAFF_LIST_SELECT,
      orderBy: { staffName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.staff.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const notFound = (userID) => {
  const err = new Error(`No staff member exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

// Same fields as the list view, plus managedShelters — the shelter(s), if
// any, where this staff member is the currently-assigned manager.
const STAFF_DETAIL_SELECT = {
  ...STAFF_LIST_SELECT,
  managedShelters: { select: { shelterID: true, shelterName: true } },
};

// ——————————————— GET STAFF DETAIL (GET /staff/:id) ———————————————
const getStaffDetail = async (userID) => {
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: STAFF_DETAIL_SELECT,
  });
  if (!staff) {
    throw notFound(userID);
  }
  return staff;
};

// ——————————————— UPDATE STAFF (PATCH /staff/:id) ———————————————
// `data` is already validated and whitelisted by the controller (only
// staffDesignation and/or shelterID). Two managerStaffID side effects, both
// folded into the same transaction as plain conditional updateMany/update
// calls rather than separate reads to check first:
//   - Moving shelters clears the OLD shelter's managerStaffID (updateMany
//     only matches — and only fires — when this staff member is actually
//     that shelter's current manager, a no-op otherwise).
//   - Becoming (or remaining) a Manager at a real shelter makes them THAT
//     shelter's managerStaffID — Staff.staffDesignation and
//     Shelter.managerStaffID must never disagree about who manages a
//     shelter. Losing the Manager designation (without also changing
//     shelterID) clears it from their current shelter the same way.
const updateStaff = async (userID, data) => {
  const existing = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true, staffDesignation: true },
  });
  if (!existing) {
    throw notFound(userID);
  }

  const nextShelterID =
    "shelterID" in data ? data.shelterID : existing.shelterID;
  const nextDesignation =
    "staffDesignation" in data ? data.staffDesignation : existing.staffDesignation;
  const shelterChanging =
    "shelterID" in data && data.shelterID !== existing.shelterID;

  const operations = [prisma.staff.update({ where: { userID }, data })];

  if (shelterChanging && existing.shelterID != null) {
    operations.push(
      prisma.shelter.updateMany({
        where: { shelterID: existing.shelterID, managerStaffID: userID },
        data: { managerStaffID: null },
      }),
    );
  }

  if (nextDesignation === "Manager" && nextShelterID != null) {
    operations.push(
      prisma.shelter.update({
        where: { shelterID: nextShelterID },
        data: { managerStaffID: userID },
      }),
    );
  } else if (
    existing.staffDesignation === "Manager" &&
    !shelterChanging &&
    existing.shelterID != null
  ) {
    // Demoted away from Manager, shelter unchanged — the block above only
    // clears the OLD shelter when shelterID itself is changing, so this
    // covers "still at the same shelter, no longer its manager".
    operations.push(
      prisma.shelter.updateMany({
        where: { shelterID: existing.shelterID, managerStaffID: userID },
        data: { managerStaffID: null },
      }),
    );
  }

  try {
    await prisma.$transaction(operations);
  } catch (err) {
    if (err.code === "P2025") {
      // Lost a race with a delete between the findUnique above and this update.
      throw notFound(userID);
    }
    if (err.code === "P2003") {
      // FK violation — shelterID points at a missing shelter.
      const e = new Error("shelterID does not reference an existing shelter");
      e.code = "BAD_REQUEST";
      throw e;
    }
    throw err;
  }

  return getStaffDetail(userID);
};

// ——————————————— UPDATE STATUS (PATCH /staff/:id/status) ———————————————
// Deactivating clears managerStaffID on every shelter this staff member
// currently manages (updateMany — a no-op if they don't manage any), so a
// deactivated account can never keep sitting as a shelter's manager of
// record. Login itself already rejects a Deactivated staff account
// (see auth.service.js's role-agnostic accountStatus check) — nothing further
// is needed there.
// Also stamps staffDOJ/staffDOS — see utils/staffDates.js.
// Admin approves/declines Pending *Manager* sign-ups only — approving one
// also makes them their shelter's manager (Shelter.managerStaffID), in the
// same transaction. Every other Pending staff member is their shelter
// manager's to approve (Staff tab). Deactivating/reactivating an existing
// member stays Admin's either way.
const updateStaffStatus = async (userID, accountStatus) => {
  const current = await prisma.staff.findUnique({
    where: { userID },
    select: {
      staffDOJ: true,
      accountStatus: true,
      staffDesignation: true,
      shelterID: true,
      shelter: { select: { managerStaffID: true } },
    },
  });
  if (!current) {
    throw notFound(userID);
  }

  const approvingManager =
    current.accountStatus === "Pending" && accountStatus === "Active";
  if (current.accountStatus === "Pending") {
    if (current.staffDesignation !== "Manager") {
      const err = new Error(
        "Admin approves Manager sign-ups only — this staff member's shelter manager approves them",
      );
      err.code = "FORBIDDEN";
      throw err;
    }
    // Two first-sign-ups could race to Manager; only one can take the seat.
    if (approvingManager && current.shelter?.managerStaffID != null) {
      const err = new Error("This shelter already has a manager");
      err.code = "CONFLICT";
      throw err;
    }
  }

  const operations = [
    prisma.staff.update({
      where: { userID },
      data: { accountStatus, ...staffStatusDates(accountStatus, current) },
    }),
  ];

  if (accountStatus === "Deactivated") {
    operations.push(
      prisma.shelter.updateMany({
        where: { managerStaffID: userID },
        data: { managerStaffID: null },
      }),
    );
  }
  if (approvingManager && current.shelterID !== null) {
    operations.push(
      prisma.shelter.update({
        where: { shelterID: current.shelterID },
        data: { managerStaffID: userID },
      }),
    );
  }

  try {
    await prisma.$transaction(operations);
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(userID);
    }
    throw err;
  }

  return getStaffDetail(userID);
};

module.exports = { listStaff, getStaffDetail, updateStaff, updateStaffStatus };
