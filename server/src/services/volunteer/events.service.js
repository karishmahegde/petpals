const prisma = require("../../config/prisma");
const { LIST_SELECT } = require("../public/events.service");

// Every event at the volunteer's own shelter — read-only. Staff decide who
// works an event (POST /events, PUT /events/:id volunteerIDs → VolunteerEvent
// rows); a volunteer just sees the events and which ones they're on.

// ——————————————— GET /volunteers/me/events ———————————————
// Same item shape as the public GET /events, plus `assigned` — whether staff
// have put this volunteer on the event. upcoming: true → not started yet,
// soonest first; false → already started, most recent first; undefined →
// every event, soonest first (the same split as the public list).
// assigned: true → only events the volunteer is on. dateTo (inclusive)
// caps eventDate — with upcoming=true that's "between now and dateTo".
const listMyShelterEvents = async (
  volunteerID,
  { upcoming, assigned, dateTo, page = 1, limit = 20 } = {},
) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userID: volunteerID },
    select: { shelterID: true },
  });
  // No shelter → a sentinel that can never match ("found nothing"), same
  // convention as the staff lists.
  const where = { shelterID: volunteer?.shelterID ?? -1 };
  if (upcoming === true) {
    where.eventDate = { gt: new Date() };
  } else if (upcoming === false) {
    where.eventDate = { lte: new Date() };
  }
  if (dateTo) {
    where.eventDate = { ...where.eventDate, lte: dateTo };
  }
  if (assigned) {
    where.volunteers = { some: { volunteerID } };
  }

  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      select: {
        ...LIST_SELECT,
        // At most this volunteer's own row — enough to set `assigned`
        // without exposing who else is on the event.
        volunteers: { where: { volunteerID }, select: { volunteerID: true } },
      },
      orderBy: { eventDate: upcoming === false ? "desc" : "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data: rows.map(({ volunteers, ...event }) => ({
      ...event,
      assigned: volunteers.length > 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

module.exports = { listMyShelterEvents };
