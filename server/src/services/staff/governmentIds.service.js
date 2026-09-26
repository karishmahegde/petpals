const prisma = require("../../config/prisma");
const storage = require("../storage");

// The ID-verification queue (Staff dashboard → ID Verification, and the
// same endpoints for Admin). Who reviews whose ID:
// - Admin: shelter Managers', and other Admins'.
// - A shelter's manager: its Staff, Veterinarians, Volunteers, and Adopters.
// - Any other staff member: Adopters and Volunteers.
// Nobody reviews their own ID. (Mirrors account approval: Admin approves
// Managers and Admins, Managers approve their staff and vets.)
// "Connected to the shelter" for a staff-side reviewer: an Adopter through
// at least one AdoptionApplication there; Volunteer/Staff/Veterinarian by
// their own shelterID. Admin reviews are network-wide.
const PERSON_TYPES = {
  Adopter: { model: "adopter", nameField: "adopterName" },
  Volunteer: { model: "volunteer", nameField: "volunteerName" },
  Staff: { model: "staff", nameField: "staffName" },
  Veterinarian: { model: "veterinarian", nameField: "vetName" },
  Admin: { model: "admin", nameField: "adminName" },
};
const REVIEWABLE_USER_TYPES = Object.keys(PERSON_TYPES);

// Which person types each kind of reviewer may review (see above).
const REVIEWER_USER_TYPES = {
  admin: ["Staff", "Admin"], // Staff narrowed to Managers
  manager: ["Adopter", "Volunteer", "Staff", "Veterinarian"],
  staff: ["Adopter", "Volunteer"],
};

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

const forbiddenType = () => {
  const err = new Error("You aren't responsible for reviewing this person's ID");
  err.code = "FORBIDDEN";
  return err;
};

const forbiddenSelf = () => {
  const err = new Error("You can't review your own government ID");
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

// Who the caller is, for scoping: the shelter they review for and which
// person types they may review (REVIEWER_USER_TYPES). Staff -> own shelter
// (or the -1 sentinel if unassigned); Admin -> an explicit shelterID param
// (narrows Managers to that shelter's) or undefined (network-wide).
const resolveReviewScope = async ({ role, userID }, shelterIDParam) => {
  if (role === "Admin") {
    if (shelterIDParam !== undefined) {
      const shelter = await prisma.shelter.findUnique({
        where: { shelterID: shelterIDParam },
        select: { shelterID: true },
      });
      if (!shelter) throw shelterNotFound(shelterIDParam);
    }
    return {
      shelterID: shelterIDParam,
      userTypes: REVIEWER_USER_TYPES.admin,
      isAdmin: true,
    };
  }

  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true, shelter: { select: { managerStaffID: true } } },
  });
  const isManager = staff?.shelter?.managerStaffID === userID;
  return {
    shelterID: staff?.shelterID ?? -1,
    userTypes: isManager ? REVIEWER_USER_TYPES.manager : REVIEWER_USER_TYPES.staff,
  };
};

// GovernmentID has no relation field to any person table (just a bare
// userID + userType) — so shelter-scoping and name-filtering can't ride
// along in a single nested-select query like every other tab. This
// resolves "which userIDs, of each type, are connected to this shelter" as
// its own step (minus the caller themself), then the caller filters
// GovernmentID rows by userID afterwards.
// Admin's extra narrowing for Staff rows — Managers only (see the header
// note).
const ADMIN_REVIEWABLE_WHERE = {
  Staff: { staffDesignation: "Manager" },
};

const resolveScopedUserIDs = async (scope, userTypes, callerID) => {
  const { shelterID } = scope;
  return Promise.all(
    userTypes.map(async (userType) => {
      let userIDs;
      if (userType === "Adopter") {
        const rows = await prisma.adoptionApplication.findMany({
          where: shelterID === undefined ? {} : { shelterID },
          select: { adopterID: true },
          distinct: ["adopterID"],
        });
        userIDs = rows.map((r) => r.adopterID);
      } else if (userType === "Admin") {
        // Admins belong to no shelter.
        const rows = await prisma.admin.findMany({ select: { userID: true } });
        userIDs = rows.map((r) => r.userID);
      } else {
        const where = shelterID === undefined ? {} : { shelterID };
        const adminWhere = scope.isAdmin && ADMIN_REVIEWABLE_WHERE[userType];
        const rows = await prisma[PERSON_TYPES[userType].model].findMany({
          where: adminWhere ? { AND: [where, adminWhere] } : where,
          select: { userID: true },
        });
        userIDs = rows.map((r) => r.userID);
      }
      return { userType, userIDs: userIDs.filter((id) => id !== callerID) };
    }),
  );
};

// Second-query name filter — narrows each branch's userIDs by joining
// directly to that person type's table, for the same reason
// resolveScopedUserIDs can't use a nested select.
const applyNameFilter = async (branches, name) => {
  if (!name) return branches;

  return Promise.all(
    branches.map(async (branch) => {
      if (branch.userIDs.length === 0) return branch;
      const { model, nameField } = PERSON_TYPES[branch.userType];
      const matches = await prisma[model].findMany({
        where: {
          userID: { in: branch.userIDs },
          [nameField]: { contains: name, mode: "insensitive" },
        },
        select: { userID: true },
      });
      return { ...branch, userIDs: matches.map((m) => m.userID) };
    }),
  );
};

const buildPersonFilter = (branches) => {
  if (branches.length === 0) {
    return { userID: { in: [] } }; // nothing this caller may review
  }
  if (branches.length === 1) {
    return { userType: branches[0].userType, userID: { in: branches[0].userIDs } };
  }
  return {
    OR: branches.map((b) => ({ userType: b.userType, userID: { in: b.userIDs } })),
  };
};

const personSelect = (userType) => ({
  userID: true,
  [PERSON_TYPES[userType].nameField]: true,
  avatarSeed: true,
  user: { select: { userEmail: true } },
});

const toPersonSummary = (userType, person) => ({
  name: person?.[PERSON_TYPES[userType].nameField] ?? "Unknown",
  email: person?.user?.userEmail ?? null,
  avatarSeed: person?.avatarSeed ?? null,
});

// Batched name/email lookup for a page of list rows — one query per person
// type present on the page, not one per row.
const attachPersonSummaries = async (rows) => {
  const typesOnPage = [...new Set(rows.map((r) => r.userType))];
  const people = await Promise.all(
    typesOnPage.map((userType) =>
      prisma[PERSON_TYPES[userType].model].findMany({
        where: {
          userID: {
            in: rows.filter((r) => r.userType === userType).map((r) => r.userID),
          },
        },
        select: personSelect(userType),
      }),
    ),
  );
  const byTypeAndID = new Map(
    typesOnPage.flatMap((userType, i) =>
      people[i].map((person) => [`${userType}:${person.userID}`, person]),
    ),
  );

  return rows.map((row) => {
    const person = toPersonSummary(
      row.userType,
      byTypeAndID.get(`${row.userType}:${row.userID}`),
    );
    return {
      governmentIDID: row.governmentIDID,
      userID: row.userID,
      userType: row.userType,
      personName: person.name,
      personEmail: person.email,
      personAvatarSeed: person.avatarSeed,
      idType: row.idType,
      verificationStatus: row.verificationStatus,
    };
  });
};

const fetchPersonSummary = async (userID, userType) => {
  const person = await prisma[PERSON_TYPES[userType].model].findUnique({
    where: { userID },
    select: personSelect(userType),
  });
  return toPersonSummary(userType, person);
};

// ——————————————— LIST QUEUE (GET /government-ids) ———————————————
const listGovernmentIds = async (
  actor,
  { section, userType, name, shelterID: shelterIDParam, page = 1, limit = 20 } = {},
) => {
  const scope = await resolveReviewScope(actor, shelterIDParam);
  // A userType filter the caller may not review (e.g. Staff for a
  // non-manager) just yields an empty page, not an error.
  const userTypes = userType
    ? scope.userTypes.filter((type) => type === userType)
    : scope.userTypes;

  let branches = await resolveScopedUserIDs(scope, userTypes, actor.userID);
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

// Access check for one record — same rules as resolveReviewScope/
// resolveScopedUserIDs: never your own ID, only the person types you
// review, and (staff-side) only people connected to your shelter.
const assertOwnership = async (record, actor) => {
  if (record.userID === actor.userID) throw forbiddenSelf();
  if (actor.role === "Admin") {
    await assertAdminMayReview(record);
    return;
  }
  if (actor.role !== "Staff") return;

  const scope = await resolveReviewScope(actor);
  if (!scope.userTypes.includes(record.userType)) throw forbiddenType();

  if (record.userType === "Adopter") {
    const hasApplication = await prisma.adoptionApplication.findFirst({
      where: { adopterID: record.userID, shelterID: scope.shelterID },
      select: { applicationID: true },
    });
    if (!hasApplication) throw forbiddenShelter();
  } else {
    const person = await prisma[PERSON_TYPES[record.userType].model].findUnique({
      where: { userID: record.userID },
      select: { shelterID: true },
    });
    if (person?.shelterID !== scope.shelterID) throw forbiddenShelter();
  }
};

// Admin: other Admins' IDs, and Managers' (not other staff's).
const assertAdminMayReview = async (record) => {
  if (record.userType === "Admin") return;
  if (record.userType === "Staff") {
    const person = await prisma.staff.findUnique({
      where: { userID: record.userID },
      select: { staffDesignation: true },
    });
    if (person?.staffDesignation === "Manager") return;
  }
  throw forbiddenType();
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
