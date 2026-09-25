const prisma = require("../../config/prisma");

const notFound = (id) => {
  const err = new Error(`No event exists with ID ${id}`);
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET /events ———————————————
// Where an event is held is its shelter — shelter.shelterName.
const LIST_SELECT = {
  eventID: true,
  eventName: true,
  eventDate: true,
  eventDesc: true,
  eventCategory: true,
  shelter: { select: { shelterID: true, shelterName: true } },
};

// upcomingOnly: events that haven't started yet, soonest first (public page,
// staff Overview widget, staff Events tab's Upcoming section). pastOnly:
// events already started, most recent first (staff Events tab's Past
// section). Neither: everything, soonest first. shelterIDs: any of these
// shelters (empty = all). name: case-insensitive match on eventName.
const getEvents = async (
  { shelterIDs = [], upcomingOnly = false, pastOnly = false, name } = {},
  { page = 1, limit = 20 } = {},
) => {
  const where = {};
  if (shelterIDs.length > 0) {
    where.shelterID = { in: shelterIDs };
  }
  if (name) {
    where.eventName = { contains: name, mode: "insensitive" };
  }
  if (upcomingOnly) {
    where.eventDate = { gt: new Date() };
  } else if (pastOnly) {
    where.eventDate = { lte: new Date() };
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { eventDate: pastOnly ? "desc" : "asc" },
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
  eventCategory: true,
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
