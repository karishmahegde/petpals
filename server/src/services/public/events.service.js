const prisma = require("../../config/prisma");

const notFound = (id) => {
  const err = new Error(`No event exists with ID ${id}`);
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET /events ———————————————
// eventLocation is a stored snapshot of the shelter's name at event-creation
// time (see schema.prisma's design note on Event and
// staff/events.service.js's resolveShelterForCreate) — a plain select field,
// not derived here.
const LIST_SELECT = {
  eventID: true,
  eventName: true,
  eventDate: true,
  eventDesc: true,
  eventLocation: true,
  shelter: { select: { shelterID: true, shelterName: true } },
};

const getEvents = async ({ shelterID } = {}, { page = 1, limit = 20 } = {}) => {
  const where = {};
  if (shelterID !== undefined) {
    where.shelterID = shelterID;
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { eventDate: "asc" },
      select: LIST_SELECT,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data: events,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— GET /events/:id ———————————————
const DETAIL_SELECT = {
  eventID: true,
  eventName: true,
  eventDate: true,
  eventDesc: true,
  eventLocation: true,
  shelter: {
    select: { shelterID: true, shelterName: true, shelterAddress: true },
  },
};

const getEventDetails = async (id) => {
  const event = await prisma.event.findUnique({
    where: { eventID: id },
    select: DETAIL_SELECT,
  });

  if (!event) {
    throw notFound(id);
  }

  return event;
};

module.exports = { getEvents, getEventDetails };
