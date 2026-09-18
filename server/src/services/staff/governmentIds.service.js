const prisma = require("../../config/prisma");
const storage = require("../storage");

// Scope of this feature: Adopters + Volunteers only (see plan) — Staff/
// Veterinarian/Admin GovernmentID rows go through the separate,
// pre-existing account-approval flow under Admin (AdminApprovalPanel/
// StaffApprovalPanel) and are never discoverable here.
const REVIEWABLE_USER_TYPES = ["Adopter", "Volunteer"];

const notFound = (governmentIDID) => {
  const err = new Error(`No government ID record exists with ID ${governmentIDID}`);
  err.code = "NOT_FOUND";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error(
    "You may only review government IDs for people connected to your own shelter",
  );
  err.code = "FORBIDDEN";
  return err;
};

const shelterNotFound = (shelterID) => {
  const err = new Error(`No shelter exists with ID ${shelterID}`);
  err.code = "NOT_FOUND";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// Same convention as staff/appointments.service.js's own copy — duplicated
// locally rather than shared. Staff -> own shelter (or the -1 sentinel if
// unassigned); Admin -> an explicit shelterID param, or undefined
// (unscoped, network-wide).
const resolveShelterID = async ({ role, userID }, shelterIDParam) => {
  if (role === "Admin") {
    if (shelterIDParam === undefined) return undefined;
    const shelter = await prisma.shelter.findUnique({
      where: { shelterID: shelterIDParam },
      select: { shelterID: true },
    });
    if (!shelter) throw shelterNotFound(shelterIDParam);
    return shelterIDParam;
  }
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  return staff?.shelterID ?? -1;
};

// GovernmentID has no relation field to Adopter/Volunteer (just a bare
// userID + userType) — so shelter-scoping and name-filtering can't ride
// along in a single nested-select query like every other tab this session.
// This resolves "which userIDs, of each reviewable type, are connected to
// this shelter" as its own step, then the caller filters GovernmentID rows
// by userID afterwards.
const resolveScopedUserIDs = async (shelterID, userTypeFilter) => {
  const branches = [];

  if (userTypeFilter === undefined || userTypeFilter === "Adopter") {
    const rows = await prisma.adoptionApplication.findMany({
      where: shelterID === undefined ? {} : { shelterID },
      select: { adopterID: true },
      distinct: ["adopterID"],
    });
    branches.push({ userType: "Adopter", userIDs: rows.map((r) => r.adopterID) });
  }

  if (userTypeFilter === undefined || userTypeFilter === "Volunteer") {
    const rows = await prisma.volunteer.findMany({
      where: shelterID === undefined ? {} : { shelterID },
      select: { userID: true },
    });
    branches.push({ userType: "Volunteer", userIDs: rows.map((r) => r.userID) });
  }

  return branches;
};

// Second-query name filter — narrows each branch's userIDs by joining
// directly to Adopter/Volunteer, for the same reason resolveScopedUserIDs
// can't use a nested select.
const applyNameFilter = async (branches, name) => {
  if (!name) return branches;

  return Promise.all(
    branches.map(async (branch) => {
      if (branch.userIDs.length === 0) return branch;
      if (branch.userType === "Adopter") {
        const matches = await prisma.adopter.findMany({
          where: {
            userID: { in: branch.userIDs },
            adopterName: { contains: name, mode: "insensitive" },
          },
          select: { userID: true },
        });
        return { ...branch, userIDs: matches.map((m) => m.userID) };
      }
      const matches = await prisma.volunteer.findMany({
        where: {
          userID: { in: branch.userIDs },
          volunteerName: { contains: name, mode: "insensitive" },
        },
        select: { userID: true },
      });
      return { ...branch, userIDs: matches.map((m) => m.userID) };
    }),
  );
};

const buildPersonFilter = (branches) => {
  if (branches.length === 1) {
    return { userType: branches[0].userType, userID: { in: branches[0].userIDs } };
  }
  return {
    OR: branches.map((b) => ({ userType: b.userType, userID: { in: b.userIDs } })),
  };
};

// Batched name/email lookup for a page of list rows — one query per person
// type for the whole page, not one per row.
const attachPersonSummaries = async (rows) => {
  const adopterIDs = rows.filter((r) => r.userType === "Adopter").map((r) => r.userID);
  const volunteerIDs = rows.filter((r) => r.userType === "Volunteer").map((r) => r.userID);

  const [adopters, volunteers] = await Promise.all([
    adopterIDs.length
      ? prisma.adopter.findMany({
          where: { userID: { in: adopterIDs } },
          select: {
            userID: true,
            adopterName: true,
            avatarSeed: true,
            user: { select: { userEmail: true } },
          },
        })
      : [],
    volunteerIDs.length
      ? prisma.volunteer.findMany({
          where: { userID: { in: volunteerIDs } },
          select: {
            userID: true,
            volunteerName: true,
            avatarSeed: true,
            user: { select: { userEmail: true } },
          },
        })
      : [],
  ]);

  const adopterByID = new Map(adopters.map((a) => [a.userID, a]));
  const volunteerByID = new Map(volunteers.map((v) => [v.userID, v]));

  return rows.map((row) => {
    const person =
      row.userType === "Adopter" ? adopterByID.get(row.userID) : volunteerByID.get(row.userID);
    return {
      governmentIDID: row.governmentIDID,
      userID: row.userID,
      userType: row.userType,
      personName: (row.userType === "Adopter" ? person?.adopterName : person?.volunteerName) ?? "Unknown",
      personEmail: person?.user?.userEmail ?? null,
      personAvatarSeed: person?.avatarSeed ?? null,
      idType: row.idType,
      verificationStatus: row.verificationStatus,
    };
  });
};

const fetchPersonSummary = async (userID, userType) => {
  if (userType === "Adopter") {
    const adopter = await prisma.adopter.findUnique({
      where: { userID },
      select: { adopterName: true, avatarSeed: true, user: { select: { userEmail: true } } },
    });
    return {
      name: adopter?.adopterName ?? "Unknown",
      email: adopter?.user?.userEmail ?? null,
      avatarSeed: adopter?.avatarSeed ?? null,
    };
  }
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID },
    select: { volunteerName: true, avatarSeed: true, user: { select: { userEmail: true } } },
  });
  return {
    name: volunteer?.volunteerName ?? "Unknown",
    email: volunteer?.user?.userEmail ?? null,
    avatarSeed: volunteer?.avatarSeed ?? null,
  };
};

// ——————————————— LIST QUEUE (GET /government-ids) ———————————————
const listGovernmentIds = async (
  actor,
  { section, userType, name, shelterID: shelterIDParam, page = 1, limit = 20 } = {},
) => {
  const shelterID = await resolveShelterID(actor, shelterIDParam);

  let branches = await resolveScopedUserIDs(shelterID, userType);
  branches = await applyNameFilter(branches, name);

  const where = {
    ...buildPersonFilter(branches),
    verificationStatus: section === "pending" ? "Pending" : { in: ["Verified", "Rejected"] },
  };

  const [rows, total] = await Promise.all([
    prisma.governmentID.findMany({
      where,
      select: {
        governmentIDID: true,
        userID: true,
        userType: true,
        idType: true,
        verificationStatus: true,
      },
      orderBy: { governmentIDID: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.governmentID.count({ where }),
  ]);

  const data = await attachPersonSummaries(rows);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Staff-only ownership check — Admin is unscoped. Shares the "connected to
// this shelter" rule with resolveScopedUserIDs: an Adopter needs at least
// one AdoptionApplication at this shelter, a Volunteer needs a direct
// shelterID match.
const assertOwnership = async (record, actor) => {
  if (actor.role !== "Staff") return;

  const staff = await prisma.staff.findUnique({
    where: { userID: actor.userID },
    select: { shelterID: true },
  });
  const shelterID = staff?.shelterID ?? -1;

  if (record.userType === "Adopter") {
    const hasApplication = await prisma.adoptionApplication.findFirst({
      where: { adopterID: record.userID, shelterID },
      select: { applicationID: true },
    });
    if (!hasApplication) throw forbiddenShelter();
  } else {
    const volunteer = await prisma.volunteer.findUnique({
      where: { userID: record.userID },
      select: { shelterID: true },
    });
    if (volunteer?.shelterID !== shelterID) throw forbiddenShelter();
  }
};

const DETAIL_SELECT = {
  governmentIDID: true,
  userID: true,
  userType: true,
  idType: true,
  idNumber: true,
  verificationStatus: true,
  documentURL: true,
};

const findReviewableRecord = async (governmentIDID) => {
  const record = await prisma.governmentID.findUnique({
    where: { governmentIDID },
    select: DETAIL_SELECT,
  });
  if (!record || !REVIEWABLE_USER_TYPES.includes(record.userType)) {
    // A Staff/Veterinarian/Admin GovernmentID row (out of this feature's
    // scope) is treated as not found rather than forbidden — it's never
    // meant to be discoverable through this endpoint at all.
    throw notFound(governmentIDID);
  }
  return record;
};

// ——————————————— DETAIL (GET /government-ids/:id) ———————————————
// Unlike every other place GovernmentID is exposed, this returns the FULL
// idNumber and a real, viewable document image — this is the dedicated,
// authorized verification workflow the field and the private bucket exist
// for (see plan's "Unmasking exception").
const getGovernmentIdDetail = async (governmentIDID, actor) => {
  const record = await findReviewableRecord(governmentIDID);
  await assertOwnership(record, actor);

  const person = await fetchPersonSummary(record.userID, record.userType);
  const documentURL = record.documentURL
    ? await storage.createSignedUrl(storage.GOVERNMENT_IDS_BUCKET, record.documentURL)
    : null;

  return {
    governmentIDID: record.governmentIDID,
    userID: record.userID,
    userType: record.userType,
    personName: person.name,
    personEmail: person.email,
    personAvatarSeed: person.avatarSeed,
    idType: record.idType,
    idNumber: record.idNumber,
    verificationStatus: record.verificationStatus,
    documentURL,
  };
};

// ——————————————— UPDATE STATUS (PATCH /government-ids/:id/status) ———————————————
const updateGovernmentIdStatus = async (governmentIDID, verificationStatus, actor) => {
  const record = await findReviewableRecord(governmentIDID);
  await assertOwnership(record, actor);

  if (record.verificationStatus !== "Pending") {
    throw conflict("Only a Pending government ID can be reviewed");
  }

  await prisma.governmentID.update({
    where: { governmentIDID },
    data: { verificationStatus },
  });

  return getGovernmentIdDetail(governmentIDID, actor);
};

module.exports = {
  listGovernmentIds,
  getGovernmentIdDetail,
  updateGovernmentIdStatus,
};
