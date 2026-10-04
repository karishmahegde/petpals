const prisma = require("../../config/prisma");
const {
  LIST_SELECT,
  formatListItem,
  timeframeWhere,
} = require("../staff/appointments.service");

// The vet appointments a volunteer is assigned to assist
// (Appointment.volunteerID) — read-only. Same select, list-item shape,
// status labels and upcoming/past split as the Staff tab and the vet's own
// queue (staff/appointments.service.js).

// ——————————————— GET /volunteers/me/appointments ———————————————
// upcoming: true → Scheduled and still ahead, soonest first; false → past
// or Cancelled, most recent first — the same default (false) as
// GET /vets/me/appointments.
const listMyAppointments = async (
  volunteerID,
  { upcoming = false, page = 1, limit = 20 } = {},
) => {
  const where = { volunteerID, ...timeframeWhere(upcoming) };

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

module.exports = { listMyAppointments };
