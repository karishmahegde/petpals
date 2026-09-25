const prisma = require("../../config/prisma");
const storage = require("../storage");
const { isUniqueViolation } = require("../../utils/prismaErrors");

const notFound = (appointmentID) => {
  const err = new Error(`No appointment exists with ID ${appointmentID}`);
  err.code = "NOT_FOUND";
  return err;
};

const petNotFound = (petID) => {
  const err = new Error(`No pet exists with ID ${petID}`);
  err.code = "NOT_FOUND";
  return err;
};

const vetNotFound = () => {
  const err = new Error(
    "vetID does not reference an active vet at this shelter",
  );
  err.code = "BAD_REQUEST";
  return err;
};

const volunteerNotFound = () => {
  const err = new Error(
    "volunteerID does not reference a volunteer at this shelter",
  );
  err.code = "BAD_REQUEST";
  return err;
};

const staffNotFound = () => {
  const err = new Error(
    "staffID does not reference an active staff member at this shelter",
  );
  err.code = "BAD_REQUEST";
  return err;
};

const shelterNotFound = (shelterID) => {
  const err = new Error(`No shelter exists with ID ${shelterID}`);
  err.code = "NOT_FOUND";
  return err;
};

const noShelterAssigned = () => {
  const err = new Error(
    "You must be assigned to a shelter before you can create appointments",
  );
  err.code = "CONFLICT";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error(
    "You may only act on appointments at your own shelter",
  );
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

// Same convention as staff/pets.service.js's/staff/events.service.js's own
// copies — duplicated locally rather than shared.
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

// "Completed" is never written to the row — there's no "mark complete"
// action and no cron/scheduler in this codebase to flip it automatically
// (see schema.prisma's design note on Appointment.appointmentStatus). A
// Scheduled row whose date has passed just displays as Completed here,
// computed the same way everywhere it's shown.
const deriveAppointmentStatus = (row) => {
  if (row.appointmentStatus === "Scheduled" && row.appointmentDate < new Date()) {
    return "Completed";
  }
  return row.appointmentStatus;
};

const PET_SELECT = {
  petID: true,
  petName: true,
  petPhoto: true,
  breed: {
    select: { breedName: true, species: { select: { speciesName: true } } },
  },
};

const formatPetSummary = (pet) => ({
  petID: pet.petID,
  petName: pet.petName,
  petPhoto: storage.toPublicFileUrl(storage.PET_IMAGES_BUCKET, pet.petPhoto),
  breedName: pet.breed.breedName,
  speciesName: pet.breed.species.speciesName,
});

// ——————————————— LIST SHELTER APPOINTMENTS (GET /appointments) ———————————————
const LIST_SELECT = {
  appointmentID: true,
  appointmentDate: true,
  appointmentReason: true,
  appointmentStatus: true,
  pet: { select: PET_SELECT },
  vet: { select: { vetName: true } },
};

const listShelterAppointments = async (
  actor,
  { vetID, petName, upcoming, shelterID: shelterIDParam, page = 1, limit = 20 } = {},
) => {
  const where = {};

  if (actor.role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID: actor.userID },
      select: { shelterID: true },
    });
    // No shelter assigned -> an impossible sentinel, same "searched, found
    // nothing" convention as listMyShelterPets/listTransfers.
    where.shelterID = staff?.shelterID ?? -1;
  } else if (shelterIDParam !== undefined) {
    where.shelterID = shelterIDParam;
  }
  // Admin with no shelterID param: unscoped, network-wide.

  if (upcoming) {
    where.appointmentStatus = "Scheduled";
    where.appointmentDate = { gt: new Date() };
  } else {
    where.OR = [
      { appointmentDate: { lte: new Date() } },
      { appointmentStatus: "Cancelled" },
    ];
  }

  if (vetID !== undefined) {
    where.vetID = vetID;
  }
  if (petName) {
    where.pet = { petName: { contains: petName, mode: "insensitive" } };
  }

  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { appointmentDate: upcoming ? "asc" : "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appointment.count({ where }),
  ]);

  const data = rows.map((row) => ({
    appointmentID: row.appointmentID,
    appointmentDate: row.appointmentDate,
    appointmentReason: row.appointmentReason,
    status: deriveAppointmentStatus(row),
    pet: formatPetSummary(row.pet),
    vetName: row.vet.vetName,
  }));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— APPOINTMENT DETAIL (GET /appointments/:id) ———————————————
// "Vaccines administered" has no FK to Appointment in the schema — same
// same-calendar-day approximation as the adopter-facing
// adopter/appointments.service.js's getAppointmentDetailForAdopter, reused
// verbatim rather than reinvented.
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};
const nextDay = (date) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const getShelterAppointmentDetail = async (appointmentID, actor) => {
  const appointment = await prisma.appointment.findUnique({
    where: { appointmentID },
    select: {
      appointmentID: true,
      appointmentCode: true,
      appointmentDate: true,
      appointmentReason: true,
      appointmentStatus: true,
      shelterID: true,
      vetID: true,
      staffID: true,
      volunteerID: true,
      pet: { select: PET_SELECT },
      vet: { select: { vetName: true } },
      shelter: { select: { shelterName: true } },
      staff: { select: { staffName: true } },
      volunteer: { select: { volunteerName: true } },
    },
  });
  if (!appointment) {
    throw notFound(appointmentID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, appointment.shelterID);

  const [vaccines, acceptedApplication] = await Promise.all([
    prisma.vaccinationRecord.findMany({
      where: {
        petID: appointment.pet.petID,
        administeredDate: {
          gte: startOfDay(appointment.appointmentDate),
          lt: nextDay(appointment.appointmentDate),
        },
      },
      select: {
        recordID: true,
        dueDate: true,
        vaccine: { select: { vaccineName: true } },
      },
      orderBy: { administeredDate: "asc" },
    }),
    prisma.adoptionApplication.findFirst({
      where: { petID: appointment.pet.petID, applicationStatus: "Accepted" },
      select: {
        adopter: {
          select: {
            adopterName: true,
            adopterPhone: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            zip: true,
            country: true,
            user: { select: { userEmail: true } },
          },
        },
      },
    }),
  ]);

  return {
    appointmentID: appointment.appointmentID,
    appointmentCode: appointment.appointmentCode,
    appointmentDate: appointment.appointmentDate,
    appointmentReason: appointment.appointmentReason,
    status: deriveAppointmentStatus(appointment),
    pet: formatPetSummary(appointment.pet),
    vetID: appointment.vetID,
    staffID: appointment.staffID,
    volunteerID: appointment.volunteerID,
    vetName: appointment.vet.vetName,
    shelterName: appointment.shelter.shelterName,
    staffName: appointment.staff ? appointment.staff.staffName : null,
    volunteerName: appointment.volunteer ? appointment.volunteer.volunteerName : null,
    vaccinesAdministered: vaccines.map((v) => ({
      recordID: v.recordID,
      vaccineName: v.vaccine.vaccineName,
      dueDate: v.dueDate,
    })),
    adopter: acceptedApplication
      ? {
          adopterName: acceptedApplication.adopter.adopterName,
          adopterPhone: acceptedApplication.adopter.adopterPhone,
          adopterEmail: acceptedApplication.adopter.user.userEmail,
          address: [
            acceptedApplication.adopter.addressLine1,
            acceptedApplication.adopter.addressLine2,
            acceptedApplication.adopter.city,
            acceptedApplication.adopter.state,
            acceptedApplication.adopter.zip,
            acceptedApplication.adopter.country,
          ]
            .filter(Boolean)
            .join(", "),
        }
      : null,
  };
};

// Shared by create + update — each ID is checked only when present, so a
// partial update validates just what it changes.
const assertAssigneesAtShelter = async (shelterID, { vetID, staffID, volunteerID }) => {
  if (vetID !== undefined) {
    const vet = await prisma.veterinarian.findUnique({
      where: { userID: vetID },
      select: { shelterID: true, accountStatus: true },
    });
    if (!vet || vet.shelterID !== shelterID || vet.accountStatus !== "Active") {
      throw vetNotFound();
    }
  }

  if (volunteerID !== undefined && volunteerID !== null) {
    const volunteer = await prisma.volunteer.findUnique({
      where: { userID: volunteerID },
      select: { shelterID: true },
    });
    if (!volunteer || volunteer.shelterID !== shelterID) {
      throw volunteerNotFound();
    }
  }

  if (staffID !== undefined && staffID !== null) {
    const staff = await prisma.staff.findUnique({
      where: { userID: staffID },
      select: { shelterID: true, accountStatus: true },
    });
    if (!staff || staff.shelterID !== shelterID || staff.accountStatus !== "Active") {
      throw staffNotFound();
    }
  }
};

const DUPLICATE_SLOT_MESSAGE =
  "An appointment for this pet with this vet at this date/time already exists";

// Guards against the double-submit case (a slow/dropped response reads as
// a failure, the caller resubmits, and both requests land) — same pet +
// vet + exact timestamp is never a legitimate second booking, Scheduled
// rows only (a re-booked slot after a Cancelled one is fine). On update,
// the appointment being edited is excluded so saving it unchanged is fine.
const assertNoDuplicateSlot = async ({
  petID,
  vetID,
  appointmentDate,
  excludeAppointmentID,
}) => {
  const duplicate = await prisma.appointment.findFirst({
    where: {
      petID,
      vetID,
      appointmentDate,
      appointmentStatus: "Scheduled",
      ...(excludeAppointmentID !== undefined && {
        NOT: { appointmentID: excludeAppointmentID },
      }),
    },
    select: { appointmentID: true },
  });
  if (duplicate) {
    throw conflict(DUPLICATE_SLOT_MESSAGE);
  }
};

// ——————————————— CREATE APPOINTMENT (POST /appointments) ———————————————
const createAppointment = async ({ data, actor, requestedShelterID }) => {
  const shelterID = await resolveShelterIDForCreate(actor, requestedShelterID);

  const pet = await prisma.pet.findUnique({
    where: { petID: data.petID },
    select: { petID: true, shelterID: true },
  });
  if (!pet) {
    throw petNotFound(data.petID);
  }
  if (pet.shelterID !== shelterID) {
    throw badRequest("petID does not belong to this shelter");
  }

  await assertAssigneesAtShelter(shelterID, data);
  // Optional — falls back to the acting Staff member (null for an Admin
  // actor), same as before this field was client-selectable.
  const staffID = data.staffID ?? (actor.role === "Staff" ? actor.userID : null);

  await assertNoDuplicateSlot(data);

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        petID: data.petID,
        vetID: data.vetID,
        volunteerID: data.volunteerID ?? null,
        shelterID,
        appointmentDate: data.appointmentDate,
        appointmentReason: data.appointmentReason,
        staffID,
      },
      select: { appointmentID: true },
    });
  } catch (err) {
    // Closes the race the findFirst check above can't — the hand-applied
    // partial unique index (see schema.prisma's design note) rejects a
    // near-simultaneous duplicate that slipped past the pre-check.
    if (isUniqueViolation(err)) {
      throw conflict(DUPLICATE_SLOT_MESSAGE);
    }
    throw err;
  }

  return getShelterAppointmentDetail(appointment.appointmentID, actor);
};

// ——————————————— UPDATE APPOINTMENT (PATCH /appointments/:id) ———————————————
// Reschedule/reassign an appointment that is still Scheduled and upcoming —
// same rule as cancelAppointment. petID, shelterID and status are never
// editable (a different pet is a different appointment; status has its own
// Cancel flow, and completion is the vet's, Sprint 5). Partial: only fields
// present in `data` change; volunteerID may be null to unassign. Re-runs
// every create-time check against the MERGED values.
const updateAppointment = async (appointmentID, data, actor) => {
  const existing = await prisma.appointment.findUnique({
    where: { appointmentID },
    select: {
      petID: true,
      vetID: true,
      shelterID: true,
      appointmentDate: true,
      appointmentStatus: true,
    },
  });
  if (!existing) {
    throw notFound(appointmentID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, existing.shelterID);

  if (deriveAppointmentStatus(existing) !== "Scheduled") {
    throw conflict("Only a Scheduled, upcoming appointment can be edited");
  }

  await assertAssigneesAtShelter(existing.shelterID, data);
  await assertNoDuplicateSlot({
    petID: existing.petID,
    vetID: data.vetID ?? existing.vetID,
    appointmentDate: data.appointmentDate ?? existing.appointmentDate,
    excludeAppointmentID: appointmentID,
  });

  try {
    await prisma.appointment.update({ where: { appointmentID }, data });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(DUPLICATE_SLOT_MESSAGE);
    }
    throw err;
  }

  return getShelterAppointmentDetail(appointmentID, actor);
};

// ——————————————— CANCEL APPOINTMENT (PATCH /appointments/:id/cancel) ———————————————
const cancelAppointment = async (appointmentID, actor) => {
  const appointment = await prisma.appointment.findUnique({
    where: { appointmentID },
    select: { shelterID: true, appointmentStatus: true, appointmentDate: true },
  });
  if (!appointment) {
    throw notFound(appointmentID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, appointment.shelterID);

  if (deriveAppointmentStatus(appointment) !== "Scheduled") {
    throw conflict("Only a Scheduled, upcoming appointment can be cancelled");
  }

  await prisma.appointment.update({
    where: { appointmentID },
    data: { appointmentStatus: "Cancelled" },
  });

  return getShelterAppointmentDetail(appointmentID, actor);
};

// ——————————————— VET/VOLUNTEER/STAFF ROSTERS (GET /appointments/vets, /appointments/volunteers, /appointments/staff) ———————————————
// Minimal roster listings to populate the appointment form's/filter bar's
// dropdowns — not a general vet/volunteer management API (that's a later
// sprint). Staff is scoped to their own shelter; Admin must pass shelterID
// explicitly (there's no single shelter to default to for that role, and
// "every vet/volunteer network-wide" isn't a useful dropdown).
const resolveShelterIDForRead = async ({ role, userID }, shelterIDParam) => {
  if (role === "Admin") {
    if (shelterIDParam === undefined) {
      throw badRequest("shelterID is required for Admin");
    }
    return shelterIDParam;
  }
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  return staff?.shelterID ?? -1;
};

const listShelterVets = async (actor, shelterIDParam) => {
  const shelterID = await resolveShelterIDForRead(actor, shelterIDParam);
  const vets = await prisma.veterinarian.findMany({
    where: { shelterID, accountStatus: "Active" },
    select: { userID: true, vetName: true },
    orderBy: { vetName: "asc" },
  });
  return vets.map((v) => ({ vetID: v.userID, vetName: v.vetName }));
};

const listShelterVolunteers = async (actor, shelterIDParam) => {
  const shelterID = await resolveShelterIDForRead(actor, shelterIDParam);
  const volunteers = await prisma.volunteer.findMany({
    where: { shelterID, accountStatus: "Active" },
    select: { userID: true, volunteerName: true },
    orderBy: { volunteerName: "asc" },
  });
  return volunteers.map((v) => ({ volunteerID: v.userID, volunteerName: v.volunteerName }));
};

const listShelterStaff = async (actor, shelterIDParam) => {
  const shelterID = await resolveShelterIDForRead(actor, shelterIDParam);
  const staff = await prisma.staff.findMany({
    where: { shelterID, accountStatus: "Active" },
    select: { userID: true, staffName: true },
    orderBy: { staffName: "asc" },
  });
  return staff.map((s) => ({ staffID: s.userID, staffName: s.staffName }));
};

module.exports = {
  listShelterAppointments,
  getShelterAppointmentDetail,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  listShelterVets,
  listShelterVolunteers,
  listShelterStaff,
};
