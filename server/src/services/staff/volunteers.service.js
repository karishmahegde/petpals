const prisma = require("../../config/prisma");

const notFound = (userID) => {
  const err = new Error(`No volunteer exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error("You may only act on volunteers at your own shelter");
  err.code = "FORBIDDEN";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// Same convention as the other staff/*.service.js files' own copies —
// duplicated locally rather than shared.
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

// Staff-driven account transitions: approve/decline a Pending registration,
// or deactivate an Active volunteer. Banned is never set from here.
const ALLOWED_TRANSITIONS = {
  Pending: ["Active", "Deactivated"],
  Active: ["Deactivated"],
};

// ——————————————— LIST VOLUNTEERS (GET /volunteers) ———————————————
const listVolunteers = async (
  actor,
  { accountStatus, name, shelterID: shelterIDParam, page = 1, limit = 20 } = {},
) => {
  const where = {};

  if (actor.role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID: actor.userID },
      select: { shelterID: true },
    });
    // No shelter assigned -> a sentinel that can never match, same
    // "searched, found nothing" convention as listTransfers.
    where.shelterID = staff?.shelterID ?? -1;
  } else if (shelterIDParam !== undefined) {
    where.shelterID = shelterIDParam;
  }
  // Admin with no shelterID param: unscoped, network-wide.

  if (accountStatus) {
    where.accountStatus = accountStatus;
  }
  if (name) {
    where.volunteerName = { contains: name, mode: "insensitive" };
  }

  const [rows, total] = await Promise.all([
    prisma.volunteer.findMany({
      where,
      select: {
        userID: true,
        volunteerName: true,
        volunteerPhone: true,
        accountStatus: true,
        user: { select: { userEmail: true } },
      },
      orderBy: { volunteerName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.volunteer.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      userID: row.userID,
      volunteerName: row.volunteerName,
      volunteerPhone: row.volunteerPhone,
      volunteerEmail: row.user.userEmail,
      accountStatus: row.accountStatus,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— VOLUNTEER DETAIL (GET /volunteers/:id) ———————————————
// Every Volunteer column, plus the login email and the volunteer's
// government ID type/number (GovernmentID is unique per userID+userType).
const getVolunteerDetail = async (userID, actor) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID },
    select: {
      userID: true,
      volunteerCode: true,
      avatarSeed: true,
      volunteerName: true,
      volunteerAddress: true,
      volunteerPhone: true,
      volunteerDOB: true,
      volunteerSex: true,
      volunteerSchedule: true,
      shelterID: true,
      createdAt: true,
      accountStatus: true,
      shelter: { select: { shelterName: true } },
      user: { select: { userEmail: true } },
    },
  });
  if (!volunteer) {
    throw notFound(userID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, volunteer.shelterID);

  const governmentID = await prisma.governmentID.findUnique({
    where: { userID_userType: { userID, userType: "Volunteer" } },
    select: { idType: true, idNumber: true },
  });

  const { shelter, user, ...rest } = volunteer;
  return {
    ...rest,
    shelterName: shelter?.shelterName ?? null,
    volunteerEmail: user.userEmail,
    governmentID,
  };
};

// ——————————————— UPDATE STATUS (PATCH /volunteers/:id/status) ———————————————
const updateVolunteerStatus = async (userID, { accountStatus }, actor) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID },
    select: { shelterID: true, accountStatus: true },
  });
  if (!volunteer) {
    throw notFound(userID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, volunteer.shelterID);

  if (!ALLOWED_TRANSITIONS[volunteer.accountStatus]?.includes(accountStatus)) {
    throw conflict(
      `A ${volunteer.accountStatus} volunteer can't be moved to ${accountStatus}`,
    );
  }

  await prisma.volunteer.update({ where: { userID }, data: { accountStatus } });

  return getVolunteerDetail(userID, actor);
};

module.exports = { listVolunteers, getVolunteerDetail, updateVolunteerStatus };
