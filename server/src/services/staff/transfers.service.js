const prisma = require("../../config/prisma");
const storage = require("../storage");
const { formatSex, formatAgeFromDOBYears } = require("../public/pets.service");

const notFound = (recordID) => {
  const err = new Error(`No transfer exists with ID ${recordID}`);
  err.code = "NOT_FOUND";
  return err;
};

const petNotFound = (petID) => {
  const err = new Error(`No pet exists with ID ${petID}`);
  err.code = "NOT_FOUND";
  return err;
};

const shelterNotFound = (shelterID) => {
  const err = new Error(`No shelter exists with ID ${shelterID}`);
  err.code = "NOT_FOUND";
  return err;
};

const noShelterAssigned = () => {
  const err = new Error(
    "You must be assigned to a shelter before you can initiate transfers",
  );
  err.code = "CONFLICT";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error("You may only act on transfers at your own shelter");
  err.code = "FORBIDDEN";
  return err;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

const forbidden = (message) => {
  const err = new Error(message);
  err.code = "FORBIDDEN";
  return err;
};

// Same convention as staff/pets.service.js's/staff/events.service.js's own
// copies — duplicated locally rather than shared, since each file's error
// factories (and thus the message a mismatch throws) are its own.
const assertStaffOwnsShelter = async (role, userID, shelterID) => {
  if (role !== "Staff") return;
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (shelterID !== staff?.shelterID) {
    throw forbiddenShelter();
  }
};

const resolveShelterIDForCreate = async ({ role, userID }, requestedShelterID) => {
  if (role === "Admin") {
    const shelter = await prisma.shelter.findUnique({
      where: { shelterID: requestedShelterID },
      select: { shelterID: true },
    });
    if (!shelter) {
      throw shelterNotFound(requestedShelterID);
    }
    return requestedShelterID;
  }

  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (!staff?.shelterID) {
    throw noShelterAssigned();
  }
  return staff.shelterID;
};

const TRANSFER_LIST_SELECT = {
  recordID: true,
  petID: true,
  transferDate: true,
  fromShelterID: true,
  toShelterID: true,
  transferStatus: true,
  transferReason: true,
  pet: {
    select: {
      petName: true,
      petPhoto: true,
      breed: {
        select: { breedName: true, species: { select: { speciesName: true } } },
      },
    },
  },
  fromShelter: { select: { shelterName: true } },
  toShelter: { select: { shelterName: true } },
};

const TRANSFER_DETAIL_SELECT = {
  ...TRANSFER_LIST_SELECT,
  pet: {
    select: {
      ...TRANSFER_LIST_SELECT.pet.select,
      petDOB: true,
      petSex: true,
      petColor: true,
    },
  },
  fromShelterStaff: true,
  toShelterStaff: true,
  toShelter: { select: { shelterName: true, managerStaffID: true } },
  fromStaff: { select: { staffName: true } },
  toStaff: { select: { staffName: true } },
};

// Only the destination shelter's manager (Shelter.managerStaffID — kept in
// sync with staffDesignation 'Manager' by admin/staff.service.js) may
// reassign toShelterStaff, and only while the transfer is still open. Admin
// may too, same as every other Staff-side action here.
const canReassignToShelterStaff = (row, actor) =>
  row.transferStatus === "In_Progress" &&
  (actor.role === "Admin" || row.toShelter.managerStaffID === actor.userID);

const formatTransferListItem = (row) => ({
  recordID: row.recordID,
  petID: row.petID,
  transferDate: row.transferDate,
  fromShelterID: row.fromShelterID,
  toShelterID: row.toShelterID,
  transferStatus: row.transferStatus,
  transferReason: row.transferReason,
  pet: {
    petName: row.pet.petName,
    petPhoto: storage.toPublicFileUrl(storage.PET_IMAGES_BUCKET, row.pet.petPhoto),
    breedName: row.pet.breed.breedName,
    speciesName: row.pet.breed.species.speciesName,
  },
  fromShelter: { shelterName: row.fromShelter.shelterName },
  toShelter: { shelterName: row.toShelter.shelterName },
});

const formatTransferDetail = (row, actor) => {
  const base = formatTransferListItem(row);
  return {
    ...base,
    pet: {
      ...base.pet,
      petAge: formatAgeFromDOBYears(row.pet.petDOB),
      petSex: formatSex(row.pet.petSex),
      petColor: row.pet.petColor,
    },
    fromShelterStaff: row.fromShelterStaff,
    toShelterStaff: row.toShelterStaff,
    fromStaff: row.fromStaff ? { staffName: row.fromStaff.staffName } : null,
    toStaff: row.toStaff ? { staffName: row.toStaff.staffName } : null,
    canReassignToShelterStaff: canReassignToShelterStaff(row, actor),
  };
};

// ——————————————— INITIATE TRANSFER (POST /transfers) ———————————————
// Only a pet currently 'available' at the initiating shelter may be
// transferred — mirrors the adoption-application eligibility check
// (adopter/adoptionApplications.service.js's validateApplicationEligibility).
// While the transfer is In_Progress the pet sits at adoptionStatus
// 'transferred', outside the normal available/adopted flow, and only
// reverts (to 'available', win or lose) once the transfer resolves — see
// updateTransferStatus.
// Assigned staff on both sides is fixed at creation: fromShelterStaff is the
// initiating staff member, toShelterStaff the destination shelter's manager
// (null if it has none yet). Only that manager may later reassign
// toShelterStaff — see reassignToShelterStaff.
const initiateTransfer = async ({ petID, data, actor, requestedShelterID }) => {
  const fromShelterID = await resolveShelterIDForCreate(actor, requestedShelterID);

  const pet = await prisma.pet.findUnique({
    where: { petID },
    select: { petID: true, shelterID: true, adoptionStatus: true },
  });
  if (!pet) {
    throw petNotFound(petID);
  }

  // Staff: catches a caller trying to transfer a pet that isn't at their own
  // shelter. Admin: no-op here, but a bad explicit fromShelterID is still
  // caught by the mismatch check right below.
  await assertStaffOwnsShelter(actor.role, actor.userID, pet.shelterID);
  if (fromShelterID !== pet.shelterID) {
    throw badRequest(
      `fromShelterID does not match this pet's current shelter (shelterID ${pet.shelterID})`,
    );
  }

  if (pet.adoptionStatus !== "available") {
    throw conflict(
      `This pet is not currently available for transfer (status: ${pet.adoptionStatus})`,
    );
  }

  if (data.toShelterID === fromShelterID) {
    throw badRequest("toShelterID must differ from the pet's current shelter");
  }
  const toShelter = await prisma.shelter.findUnique({
    where: { shelterID: data.toShelterID },
    select: { shelterID: true, managerStaffID: true },
  });
  if (!toShelter) {
    throw shelterNotFound(data.toShelterID);
  }

  const [record] = await prisma.$transaction([
    prisma.transferHistory.create({
      data: {
        petID,
        fromShelterID,
        toShelterID: data.toShelterID,
        transferReason: data.transferReason,
        transferDate: new Date(),
        transferStatus: "In_Progress",
        fromShelterStaff: actor.role === "Staff" ? actor.userID : null,
        toShelterStaff: toShelter.managerStaffID,
      },
      select: TRANSFER_DETAIL_SELECT,
    }),
    prisma.pet.update({ where: { petID }, data: { adoptionStatus: "transferred" } }),
  ]);

  return formatTransferDetail(record, actor);
};

// ——————————————— ASSIGNEES PREVIEW (GET /transfers/assignees) ———————————————
// What initiateTransfer WILL assign for a given destination, so the Initiate
// Transfer form can show both (read-only) staff fields before submitting —
// same resolution rules as the create itself, so the preview can't drift.
const getTransferAssignees = async (actor, toShelterID) => {
  const [fromStaff, toShelter] = await Promise.all([
    actor.role === "Staff"
      ? prisma.staff.findUnique({
          where: { userID: actor.userID },
          select: { userID: true, staffName: true },
        })
      : null,
    toShelterID === undefined
      ? null
      : prisma.shelter.findUnique({
          where: { shelterID: toShelterID },
          select: { manager: { select: { userID: true, staffName: true } } },
        }),
  ]);
  if (toShelterID !== undefined && !toShelter) {
    throw shelterNotFound(toShelterID);
  }

  const toOption = (staff) =>
    staff ? { staffID: staff.userID, staffName: staff.staffName } : null;
  return {
    fromShelterStaff: toOption(fromStaff),
    toShelterStaff: toOption(toShelter?.manager),
  };
};

// ——————————————— LIST TRANSFERS (GET /transfers) ———————————————
// direction picks which side of the record is "this shelter": 'incoming'
// scopes to toShelterID (Pending Transfers — awaiting this shelter's
// decision), 'outgoing' scopes to fromShelterID (Ongoing Transfers — sent by
// this shelter, awaiting the other side). shelterName always searches the
// OTHER shelter on the record, not this one (searching your own shelter's
// name in a list already scoped to it would be pointless).
const listTransfers = async (
  actor,
  {
    direction,
    status,
    shelterName,
    petName,
    shelterID: shelterIDParam,
    page = 1,
    limit = 20,
  } = {},
) => {
  const where = {};

  if (actor.role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID: actor.userID },
      select: { shelterID: true },
    });
    // No shelter assigned -> a sentinel that can never match, same
    // "searched, found nothing" convention as listApplicationsForStaff.
    const myShelterID = staff?.shelterID ?? -1;
    if (direction === "incoming") where.toShelterID = myShelterID;
    else where.fromShelterID = myShelterID;
  } else if (shelterIDParam !== undefined) {
    if (direction === "incoming") where.toShelterID = shelterIDParam;
    else where.fromShelterID = shelterIDParam;
  }
  // Admin with no shelterID param: unscoped, network-wide.

  if (status) {
    where.transferStatus = status;
  }

  if (petName) {
    where.pet = { petName: { contains: petName, mode: "insensitive" } };
  }

  if (shelterName) {
    const otherShelterFilter = {
      shelterName: { contains: shelterName, mode: "insensitive" },
    };
    if (direction === "incoming") where.fromShelter = otherShelterFilter;
    else where.toShelter = otherShelterFilter;
  }

  const [rows, total] = await Promise.all([
    prisma.transferHistory.findMany({
      where,
      select: TRANSFER_LIST_SELECT,
      orderBy: { transferDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transferHistory.count({ where }),
  ]);

  return {
    data: rows.map(formatTransferListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— GET TRANSFER BY ID (GET /transfers/:id) ———————————————
// Stricter than adoptionApplications' getApplicationById (which lets any
// Staff/Admin view any application) — a transfer record names a specific
// OTHER shelter and that shelter's stated reason for giving away/receiving a
// pet, which is more sensitive than an application. A Staff caller may only
// view a transfer touching their own shelter, on either side; Admin may view
// any.
const getTransferById = async (recordID, actor) => {
  const transfer = await prisma.transferHistory.findUnique({
    where: { recordID },
    select: TRANSFER_DETAIL_SELECT,
  });
  if (!transfer) {
    throw notFound(recordID);
  }

  if (actor.role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID: actor.userID },
      select: { shelterID: true },
    });
    const myShelterID = staff?.shelterID;
    if (transfer.fromShelterID !== myShelterID && transfer.toShelterID !== myShelterID) {
      throw forbiddenShelter();
    }
  }

  return formatTransferDetail(transfer, actor);
};

// ——————————————— UPDATE TRANSFER STATUS (PATCH /transfers/:id/status) ———————————————
// Single entry point for every resolution of an In_Progress transfer, same
// shape as adoptionApplications.service.js's updateApplicationStatus: one
// authorization check (which side of the record depends on the REQUESTED
// status, not the actor's role alone), one status-guard check, one
// $transaction touching both the transfer record and the pet.
//   - Completed/Rejected: only the DESTINATION shelter (toShelterID) decides.
//   - Cancelled: only the ORIGIN shelter (fromShelterID) may retract.
// Completed reassigns the pet to its new shelter and clears staffID (the new
// shelter hasn't assigned anyone yet); Rejected/Cancelled leave the pet
// where it was. Both paths flip adoptionStatus back to 'available'. The
// assigned from/to staff are left untouched — they're set at creation (and
// by the destination manager's reassign), not by whoever resolves it.
const updateTransferStatus = async (recordID, { status }, actor) => {
  const transfer = await prisma.transferHistory.findUnique({
    where: { recordID },
    select: {
      recordID: true,
      petID: true,
      fromShelterID: true,
      toShelterID: true,
      transferStatus: true,
    },
  });
  if (!transfer) {
    throw notFound(recordID);
  }

  const isDestinationAction = status === "Completed" || status === "Rejected";
  const relevantShelterID = isDestinationAction
    ? transfer.toShelterID
    : transfer.fromShelterID;
  await assertStaffOwnsShelter(actor.role, actor.userID, relevantShelterID);

  if (transfer.transferStatus !== "In_Progress") {
    throw conflict(
      `A ${transfer.transferStatus} transfer can't be moved to ${status}`,
    );
  }

  const petData =
    status === "Completed"
      ? { shelterID: transfer.toShelterID, adoptionStatus: "available", staffID: null }
      : { adoptionStatus: "available" };

  const [updated] = await prisma.$transaction([
    prisma.transferHistory.update({
      where: { recordID },
      data: { transferStatus: status },
      select: TRANSFER_DETAIL_SELECT,
    }),
    prisma.pet.update({ where: { petID: transfer.petID }, data: petData }),
  ]);

  return formatTransferDetail(updated, actor);
};

// ——————————————— REASSIGN DESTINATION STAFF (PATCH /transfers/:id) ———————————————
// The only editable field on a transfer. The new assignee must be an Active
// staff member at the destination shelter.
const reassignToShelterStaff = async (recordID, { toShelterStaff }, actor) => {
  const transfer = await prisma.transferHistory.findUnique({
    where: { recordID },
    select: {
      toShelterID: true,
      transferStatus: true,
      toShelter: { select: { managerStaffID: true } },
    },
  });
  if (!transfer) {
    throw notFound(recordID);
  }

  if (actor.role === "Staff" && transfer.toShelter.managerStaffID !== actor.userID) {
    throw forbidden(
      "Only the destination shelter's manager may reassign this transfer's staff",
    );
  }

  if (transfer.transferStatus !== "In_Progress") {
    throw conflict(`A ${transfer.transferStatus} transfer can't be reassigned`);
  }

  const assignee = await prisma.staff.findUnique({
    where: { userID: toShelterStaff },
    select: { shelterID: true, accountStatus: true },
  });
  if (assignee?.shelterID !== transfer.toShelterID || assignee.accountStatus !== "Active") {
    throw badRequest(
      "toShelterStaff must be an active staff member at the destination shelter",
    );
  }

  const updated = await prisma.transferHistory.update({
    where: { recordID },
    data: { toShelterStaff },
    select: TRANSFER_DETAIL_SELECT,
  });

  return formatTransferDetail(updated, actor);
};

module.exports = {
  initiateTransfer,
  getTransferAssignees,
  listTransfers,
  getTransferById,
  updateTransferStatus,
  reassignToShelterStaff,
};
