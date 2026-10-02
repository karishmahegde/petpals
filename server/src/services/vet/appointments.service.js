const prisma = require("../../config/prisma");
const {
  deriveAppointmentStatus,
  PET_SELECT,
  formatPetSummary,
  LIST_SELECT,
  formatListItem,
  timeframeWhere,
} = require("../staff/appointments.service");

// The vet's own appointment queue (GET /vets/me/appointments[/:id]) — only
// appointments where vetID is the caller. The list reuses the Staff tab's
// select, list-item shape, status labels and upcoming/past split
// (staff/appointments.service.js), so the frontend row components can be
// shared.

// Another vet's appointment answers exactly like a missing one — on the GETs
// and on completing — so the response never confirms that an appointmentID
// exists.
const notFound = (appointmentID) => {
  const err = new Error(`No appointment exists with ID ${appointmentID}`);
  err.code = "NOT_FOUND";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// ——————————————— LIST (GET /vets/me/appointments) ———————————————
const listMyAppointments = async (
  vetID,
  { upcoming = false, petName, page = 1, limit = 20 } = {},
) => {
  const where = { vetID, ...timeframeWhere(upcoming) };
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

  return {
    data: rows.map(formatListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— DETAIL (GET /vets/me/appointments/:id) ———————————————
// Pet, shelter, reason, status, and the vaccine doses and health notes
// already linked to this appointment (VaccinationRecord/HealthRecord
// .appointmentID). Unlike the Staff detail, no
// adopter contact details — the vet treats the animal, not the adopter.
const getMyAppointment = async (vetID, appointmentID) => {
  // Scoped by vetID in the query itself, so another vet's appointment is
  // simply not found.
  const appointment = await prisma.appointment.findFirst({
    where: { appointmentID, vetID },
    select: {
      appointmentID: true,
      appointmentCode: true,
      appointmentDate: true,
      appointmentReason: true,
      appointmentStatus: true,
      pet: { select: PET_SELECT },
      vet: { select: { vetName: true } },
      shelter: { select: { shelterID: true, shelterName: true } },
      staff: { select: { staffName: true } },
      volunteer: { select: { volunteerName: true } },
      vaccinations: {
        select: {
          recordID: true,
          administeredDate: true,
          dueDate: true,
          vaccine: { select: { vaccineName: true } },
        },
        orderBy: { administeredDate: "asc" },
      },
      healthRecords: {
        select: { recordID: true, recordDesc: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!appointment) {
    throw notFound(appointmentID);
  }

  return {
    appointmentID: appointment.appointmentID,
    appointmentCode: appointment.appointmentCode,
    appointmentDate: appointment.appointmentDate,
    appointmentReason: appointment.appointmentReason,
    status: deriveAppointmentStatus(appointment),
    pet: formatPetSummary(appointment.pet),
    vetName: appointment.vet.vetName,
    shelterID: appointment.shelter.shelterID,
    shelterName: appointment.shelter.shelterName,
    staffName: appointment.staff ? appointment.staff.staffName : null,
    volunteerName: appointment.volunteer ? appointment.volunteer.volunteerName : null,
    vaccinesAdministered: appointment.vaccinations.map((v) => ({
      recordID: v.recordID,
      vaccineName: v.vaccine.vaccineName,
      administeredDate: v.administeredDate,
      dueDate: v.dueDate,
    })),
    healthRecords: appointment.healthRecords,
  };
};

// ——————————————— COMPLETE (PATCH /appointments/:id/status) ———————————————
// The first real write of Completed. Only the assigned vet (anyone else gets
// the same 404 as a missing appointment), only from a
// stored Scheduled (a past Scheduled row merely *displays* as Completed, so
// the stored status is checked, not the derived one), and only once
// appointmentDate has passed. `notes`, when given, become a HealthRecord for
// the pet, linked to this appointment, in the same transaction — both land
// or neither does.
const completeAppointment = async (vetID, appointmentID, { notes } = {}) => {
  const appointment = await prisma.appointment.findFirst({
    where: { appointmentID, vetID },
    select: {
      petID: true,
      appointmentStatus: true,
      appointmentDate: true,
    },
  });
  if (!appointment) {
    throw notFound(appointmentID);
  }
  if (appointment.appointmentStatus !== "Scheduled") {
    throw conflict(
      `A ${appointment.appointmentStatus} appointment can't be completed`,
    );
  }
  if (appointment.appointmentDate > new Date()) {
    throw conflict("An appointment can't be completed before its scheduled time");
  }

  await prisma.$transaction(async (tx) => {
    // Guarded on Scheduled again so a concurrent cancel or a double-submitted
    // complete can't both win — whichever commits second matches no row.
    const { count } = await tx.appointment.updateMany({
      where: { appointmentID, appointmentStatus: "Scheduled" },
      data: { appointmentStatus: "Completed" },
    });
    if (count === 0) {
      throw conflict("This appointment is no longer Scheduled");
    }
    if (notes) {
      await tx.healthRecord.create({
        data: { petID: appointment.petID, vetID, appointmentID, recordDesc: notes },
      });
    }
  });

  return getMyAppointment(vetID, appointmentID);
};

module.exports = { listMyAppointments, getMyAppointment, completeAppointment };
