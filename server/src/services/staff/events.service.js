const prisma = require("../../config/prisma");
const { getEventDetails } = require("../public/events.service");

const notFound = (eventID) => {
  const err = new Error(`No event exists with ID ${eventID}`);
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
    "You must be assigned to a shelter before you can create events",
  );
  err.code = "CONFLICT";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error("You may only act on events at your own shelter");
  err.code = "FORBIDDEN";
  return err;
};

// Shared by updateEvent — a Staff caller may only act on an event whose
// shelterID matches their own current shelter, re-fetched fresh (shelterID
// is never in the JWT payload). No-op for Admin. Same convention as
// staff/pets.service.js's assertStaffOwnsShelter.
const assertStaffOwnsShelter = async (role, userID, eventShelterID) => {
  if (role !== "Staff") return;
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (eventShelterID !== staff?.shelterID) {
    throw forbiddenShelter();
  }
};

// Admin supplies shelterID explicitly (validated to exist); Staff always
// gets their own current shelter, re-fetched fresh from the STAFF table.
// Returns shelterName alongside shelterID — eventLocation is a snapshot of
// it at creation time (see schema.prisma's design note on Event), not a
// client-supplied value, so the caller needs it right here. Same convention
// as staff/pets.service.js's resolveShelterIDForCreate otherwise.
const resolveShelterForCreate = async ({ role, userID }, requestedShelterID) => {
  if (role === "Admin") {
    const shelter = await prisma.shelter.findUnique({
      where: { shelterID: requestedShelterID },
      select: { shelterID: true, shelterName: true },
    });
    if (!shelter) {
      throw shelterNotFound(requestedShelterID);
    }
    return shelter;
  }

  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true, shelter: { select: { shelterName: true } } },
  });
  if (!staff?.shelterID) {
    throw noShelterAssigned();
  }
  return { shelterID: staff.shelterID, shelterName: staff.shelter.shelterName };
};

// ——————————————— CREATE EVENT (POST /events) ———————————————
// `data` is already validated and whitelisted by the controller — it never
// contains eventLocation; that's set here from the resolved shelter's name,
// not accepted from the client (see schema.prisma's design note). staffID
// is set to the acting Staff member's own userID (never for an Admin actor
// — the column FKs Staff.userID, which an Admin doesn't have), same
// convention as staffID on AdoptionApplication/Visit.
const createEvent = async ({ data, actor, requestedShelterID }) => {
  const { shelterID, shelterName } = await resolveShelterForCreate(
    actor,
    requestedShelterID,
  );

  const event = await prisma.event.create({
    data: {
      ...data,
      shelterID,
      eventLocation: shelterName,
      staffID: actor.role === "Staff" ? actor.userID : null,
    },
  });

  return getEventDetails(event.eventID);
};

// ——————————————— UPDATE EVENT (PUT /events/:id) ———————————————
// `data` is already validated, whitelisted, and non-empty by the
// controller. shelterID/staffID reassignment is out of scope here — Staff
// is scoped to their own shelter's events only, Admin may edit any.
const updateEvent = async (eventID, data, { role, userID }) => {
  const existing = await prisma.event.findUnique({
    where: { eventID },
    select: { shelterID: true },
  });
  if (!existing) {
    throw notFound(eventID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  try {
    await prisma.event.update({ where: { eventID }, data });
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(eventID);
    }
    throw err;
  }

  return getEventDetails(eventID);
};

// ——————————————— DELETE EVENT (DELETE /events/:id) ———————————————
// Staff may only delete events at their own shelter; Admin may delete any.
// VolunteerEvent rows (volunteer signups) are pure join-table records with
// no independent lifecycle of their own — removed in the same transaction
// as the event, same convention as staff/pets.service.js's deletePet
// clearing PetPhoto rows before the Pet row.
const deleteEvent = async (eventID, { role, userID }) => {
  const existing = await prisma.event.findUnique({
    where: { eventID },
    select: { shelterID: true },
  });
  if (!existing) {
    throw notFound(eventID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  try {
    await prisma.$transaction([
      prisma.volunteerEvent.deleteMany({ where: { eventID } }),
      prisma.event.delete({ where: { eventID } }),
    ]);
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(eventID);
    }
    throw err;
  }
};

module.exports = { createEvent, updateEvent, deleteEvent };
