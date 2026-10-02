const prisma = require("../../config/prisma");

// Standalone health notes a vet writes for a pet (POST /pets/:id/health-records)
// and edits (PUT /health-records/:id) — alongside the notes written when
// completing an appointment (vet/appointments.service.js). All of them show
// on the pet's Health Passport.

const notFound = (message) => {
  const err = new Error(message);
  err.code = "NOT_FOUND";
  return err;
};

const forbidden = (message) => {
  const err = new Error(message);
  err.code = "FORBIDDEN";
  return err;
};

// Same item shape as the Health Passport's healthRecords
// (staff/pets.service.js's getHealthPassport).
const RECORD_SELECT = {
  recordID: true,
  petID: true,
  createdAt: true,
  lastUpdated: true,
  recordDesc: true,
  appointment: { select: { appointmentID: true, appointmentCode: true } },
  vet: { select: { vetName: true, shelter: { select: { shelterName: true } } } },
};

const formatRecord = (r) => ({
  recordID: r.recordID,
  petID: r.petID,
  createdAt: r.createdAt,
  lastUpdated: r.lastUpdated,
  recordDesc: r.recordDesc,
  appointmentID: r.appointment?.appointmentID ?? null,
  appointmentCode: r.appointment?.appointmentCode ?? null,
  vetName: r.vet?.vetName ?? null,
  shelterName: r.vet?.shelter?.shelterName ?? null,
});

// ——————————————— CREATE (POST /pets/:id/health-records) ———————————————
// The pet must be at the vet's own shelter (403 otherwise) — a vet reads the
// passport of any pet at their shelter, but only writes for pets in their
// care. vetID is always the caller.
const createHealthRecord = async (vetID, petID, recordDesc) => {
  const [pet, vet] = await Promise.all([
    prisma.pet.findUnique({ where: { petID }, select: { shelterID: true } }),
    prisma.veterinarian.findUnique({ where: { userID: vetID }, select: { shelterID: true } }),
  ]);
  if (!pet) {
    throw notFound(`No pet exists with ID ${petID}`);
  }
  if (!vet?.shelterID || vet.shelterID !== pet.shelterID) {
    throw forbidden("You may only add health records for pets at your own shelter");
  }

  const record = await prisma.healthRecord.create({
    data: { petID, vetID, recordDesc },
    select: RECORD_SELECT,
  });
  return formatRecord(record);
};

// ——————————————— EDIT (PUT /health-records/:id) ———————————————
// Only the vet who wrote it (403 otherwise) — that includes notes written
// when completing an appointment. Records with no vet (e.g. recorded by
// staff) can't be edited here by anyone.
const updateHealthRecord = async (vetID, recordID, recordDesc) => {
  const existing = await prisma.healthRecord.findUnique({
    where: { recordID },
    select: { vetID: true },
  });
  if (!existing) {
    throw notFound(`No health record exists with ID ${recordID}`);
  }
  if (existing.vetID !== vetID) {
    throw forbidden("Only the vet who wrote this health record can edit it");
  }

  const record = await prisma.healthRecord.update({
    where: { recordID },
    data: { recordDesc },
    select: RECORD_SELECT,
  });
  return formatRecord(record);
};

module.exports = { createHealthRecord, updateHealthRecord };
