const prisma = require("../../config/prisma");
const storage = require("../storage");
const {
  getPetDetails,
  formatPetDetail,
  PET_DETAIL_SELECT,
  formatAgeFromDOBYears,
  formatSex,
  toArray,
  matchFilter,
  buildAgeFilter,
} = require("../public/pets.service");

const notFound = (petID) => {
  const err = new Error(`No pet exists with ID ${petID}`);
  err.code = "NOT_FOUND";
  return err;
};

const breedNotFound = () => {
  const err = new Error("breedID does not reference an existing breed");
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
    "You must be assigned to a shelter before you can create pets",
  );
  err.code = "CONFLICT";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error("You may only act on pets at your own shelter");
  err.code = "FORBIDDEN";
  return err;
};

const activeApplicationConflict = () => {
  const err = new Error(
    "This pet has a Pending or Accepted adoption application and cannot be deleted",
  );
  err.code = "CONFLICT";
  return err;
};

const assertBreedExists = async (breedID) => {
  const breed = await prisma.breed.findUnique({
    where: { breedID },
    select: { breedID: true },
  });
  if (!breed) {
    throw breedNotFound();
  }
};

// Shared by updatePet and deletePet — a Staff caller may only act on a pet
// whose shelterID matches their own current shelter, re-fetched fresh (see
// resolveShelterIDForCreate's note on why). No-op for Admin.
const assertStaffOwnsShelter = async (role, userID, petShelterID) => {
  if (role !== "Staff") return;
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (petShelterID !== staff?.shelterID) {
    throw forbiddenShelter();
  }
};

// Admin supplies shelterID explicitly (validated to exist); Staff always
// gets their own current shelter, re-fetched fresh from the STAFF table —
// never trusted from the JWT (shelterID is not in the token payload — see
// 06-Auth System's design note) and never taken from the request body even
// if a Staff caller sends one (the controller doesn't read it for Staff at
// all).
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

// ——————————————— LIST MY SHELTER'S PETS (GET /staff/me/pets) ———————————————
// GET /pets (public/pets.service.js's getAvailablePets) is hardcoded to
// adoptionStatus: "available" — fine for the public catalog, useless for a
// staff management list that also needs to show incoming/pending/adopted/
// etc. pets at the staff member's own shelter. Same PetCard-ish shape as
// the public list (reuses its age/sex formatters, and its
// toArray/matchFilter/buildAgeFilter filter-building helpers, so the two
// can't drift), plus adoptionStatus, which the public shape omits. Accepts
// the same species/breed/size/minAge/maxAge filters as the public catalog
// (same query param names too) so the Staff Pets tab can reuse the exact
// same filter bar — just scoped to this shelter instead of network-wide,
// and with no location/shelter filter (there's only ever one shelter here).
const listMyShelterPets = async (
  userID,
  {
    page = 1,
    limit = 20,
    adoptionStatus,
    species,
    breed,
    size,
    minAge,
    maxAge,
    sort,
  } = {},
) => {
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (!staff?.shelterID) {
    throw noShelterAssigned();
  }

  const where = { shelterID: staff.shelterID };
  if (adoptionStatus) {
    where.adoptionStatus = adoptionStatus;
  }

  const speciesValues = toArray(species);
  const breedValues = toArray(breed);
  const sizeValues = toArray(size);

  const breedWhere = {};
  if (breedValues.length > 0) {
    breedWhere.breedName = matchFilter(breedValues);
  }
  if (speciesValues.length > 0) {
    breedWhere.species = { speciesID: matchFilter(speciesValues) };
  }
  if (Object.keys(breedWhere).length > 0) {
    where.breed = breedWhere;
  }

  if (sizeValues.length > 0) {
    where.petSize = matchFilter(sizeValues);
  }

  const ageFilter = buildAgeFilter(minAge, maxAge);
  if (ageFilter) {
    where.petDOB = ageFilter;
  }

  // sort is closed/fixed-value validated by the controller — 'newest' orders
  // by intakeDate descending (Staff Overview's New Arrivers widget); omitted,
  // this keeps the existing petID-descending default the Pets tab already
  // relies on.
  const orderBy = sort === "newest" ? { intakeDate: "desc" } : { petID: "desc" };

  const skip = (page - 1) * limit;
  const [pets, total] = await Promise.all([
    prisma.pet.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        petID: true,
        petName: true,
        petDOB: true,
        petPhoto: true,
        petSex: true,
        adoptionStatus: true,
        intakeDate: true,
        breed: {
          select: {
            breedName: true,
            species: { select: { speciesName: true } },
          },
        },
      },
    }),
    prisma.pet.count({ where }),
  ]);

  const data = pets.map((pet) => ({
    petID: pet.petID,
    petName: pet.petName,
    petAge: formatAgeFromDOBYears(pet.petDOB),
    petSex: formatSex(pet.petSex),
    petPhoto: storage.toPublicFileUrl(storage.PET_IMAGES_BUCKET, pet.petPhoto),
    adoptionStatus: pet.adoptionStatus,
    intakeDate: pet.intakeDate,
    breed: {
      breedName: pet.breed.breedName,
      speciesName: pet.breed.species.speciesName,
    },
  }));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— GET SHELTER PET DETAIL (GET /staff/me/pets/:id) ———————————————
// Richer than public GET /pets/:id (which staff also uses for the same pet,
// via the same underlying formatPetDetail) — adds the fields staff actually
// manage but the public catalog has no reason to expose: petCode,
// microchipID, petSize, petBGroup, raw petDOB (the public shape only ever
// returns the formatted petAge), intakeDate, intakeType, and featuredFlag.
// Powers the Pets tab's read-only detail view (categorized fields) and
// pre-fills the edit form with real values instead of leaving them blank
// for staff to re-enter.
const STAFF_PET_DETAIL_SELECT = {
  ...PET_DETAIL_SELECT,
  shelterID: true, // PET_DETAIL_SELECT only nests shelter.shelterID; assertStaffOwnsShelter needs the plain FK
  petCode: true,
  petSize: true,
  petBGroup: true,
  microchipID: true,
  intakeDate: true,
  intakeType: true,
  featuredFlag: true,
};

const getShelterPetDetail = async (petID, { role, userID }) => {
  const pet = await prisma.pet.findUnique({
    where: { petID },
    select: STAFF_PET_DETAIL_SELECT,
  });
  if (!pet) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, pet.shelterID);

  return {
    ...formatPetDetail(pet),
    petCode: pet.petCode,
    petDOB: pet.petDOB,
    petSize: pet.petSize,
    petBGroup: pet.petBGroup,
    microchipID: pet.microchipID,
    intakeDate: pet.intakeDate,
    intakeType: pet.intakeType,
    featuredFlag: pet.featuredFlag,
  };
};

// ——————————————— GET HEALTH PASSPORT (GET /staff/me/pets/:id/health-passport) ———————————————
// Read-only aggregate view for the pet's own full-page "passport" — reuses
// getShelterPetDetail for identity (and its ownership check — a Staff caller
// may only view a passport for a pet at their own shelter) and reads
// HealthRecord/VaccinationRecord/TransferHistory fresh alongside it. Unlike
// staff/transfers.service.js's listTransfers, transferHistory here is NOT
// scoped to the caller's own shelter — a passport is meant to show the
// pet's full cross-shelter history regardless of which shelter currently
// holds it or which shelter the viewing staff member belongs to.
const DUE_SOON_WINDOW_DAYS = 30;

// administeredDate/dueDate are both non-nullable in the schema — every row
// represents a dose that WAS given, with a next-dose dueDate to track. So
// status is driven purely by how soon/overdue that next dose is, not by
// whether the pet has ever been vaccinated at all.
const vaccinationStatus = (dueDate) => {
  const daysUntilDue = (new Date(dueDate) - Date.now()) / 86400000;
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) return "Due Soon";
  return "Up to Date";
};

const getHealthPassport = async (petID, { role, userID }) => {
  const pet = await getShelterPetDetail(petID, { role, userID });

  const [healthRecordRows, vaccinationRows, transferRows] = await Promise.all([
    prisma.healthRecord.findMany({
      where: { petID },
      orderBy: { createdAt: "desc" },
      select: {
        recordID: true,
        createdAt: true,
        recordDesc: true,
        vet: {
          select: {
            vetName: true,
            shelter: { select: { shelterName: true } },
          },
        },
      },
    }),
    prisma.vaccinationRecord.findMany({
      where: { petID },
      orderBy: { dueDate: "asc" },
      select: {
        recordID: true,
        administeredDate: true,
        dueDate: true,
        vaccine: { select: { vaccineName: true } },
      },
    }),
    prisma.transferHistory.findMany({
      where: { petID },
      orderBy: { transferDate: "desc" },
      select: {
        recordID: true,
        transferDate: true,
        transferReason: true,
        transferStatus: true,
        fromShelter: { select: { shelterName: true } },
        toShelter: { select: { shelterName: true } },
        fromStaff: { select: { staffName: true } },
        toStaff: { select: { staffName: true } },
      },
    }),
  ]);

  return {
    pet,
    healthRecords: healthRecordRows.map((r) => ({
      recordID: r.recordID,
      createdAt: r.createdAt,
      recordDesc: r.recordDesc,
      vetName: r.vet?.vetName ?? null,
      shelterName: r.vet?.shelter?.shelterName ?? null,
    })),
    vaccinations: vaccinationRows.map((r) => ({
      recordID: r.recordID,
      vaccineName: r.vaccine.vaccineName,
      administeredDate: r.administeredDate,
      dueDate: r.dueDate,
      status: vaccinationStatus(r.dueDate),
    })),
    transferHistory: transferRows.map((r) => ({
      recordID: r.recordID,
      transferDate: r.transferDate,
      transferReason: r.transferReason,
      transferStatus: r.transferStatus,
      fromShelterName: r.fromShelter.shelterName,
      toShelterName: r.toShelter.shelterName,
      fromStaffName: r.fromStaff?.staffName ?? null,
      toStaffName: r.toStaff?.staffName ?? null,
    })),
  };
};

// ——————————————— GET PHOTOS (GET /pets/:id/photos) ———————————————
// Read-only counterpart to addPhoto/deletePhoto's shared listPhotos — lets
// the Staff pet detail panel load the current gallery on open, without
// needing an upload/delete round trip first.
const getPhotos = async (petID, { role, userID }) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: { shelterID: true, petPhoto: true },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  return listPhotos(petID, existing.petPhoto);
};

// ——————————————— CREATE PET (POST /pets) ———————————————
// `data` is already validated and whitelisted by the controller (the
// schema-required fields — see the controller's CREATE_REQUIRED_FIELDS
// design note for why petName/petWeight/petHeight are required here despite
// the ticket framing them as PUT-only). Two fields are set here rather than
// accepted from the client at all: adoptionStatus always starts "available"
// so the pet is immediately visible in the public catalog (the column has
// no DB default despite being effectively required for the pet to be
// useful), and petPhoto gets a placeholder until POST /pets/:id/photos (a
// later Sprint 5.1 card) supplies a real one — the column is NOT NULL with
// no default, so pet creation can't leave it empty even though photo
// upload is a separate step.
const createPet = async ({ data, actor, requestedShelterID }) => {
  await assertBreedExists(data.breedID);
  const shelterID = await resolveShelterIDForCreate(actor, requestedShelterID);

  const pet = await prisma.pet.create({
    data: {
      ...data,
      shelterID,
      adoptionStatus: "available",
      petPhoto: "placeholder.jpg",
    },
  });

  // Reuses the exact same select + formatting the public GET /pets/:id
  // endpoint uses, so this response is guaranteed to match that shape —
  // not a hand-copied duplicate that could drift from it.
  return getPetDetails(pet.petID);
};

// ——————————————— SHARED PHOTO-REPLACE HELPERS ———————————————
// v1 supports exactly one photo per pet, not a gallery — every upload
// REPLACES whatever was there before, rather than adding to it. Shared by
// updatePet (an optional photo can now ride along with a PUT, saved
// together in one request/transaction — see logic/api/staffPetsApi.ts) and
// the standalone addPhoto (kept for API callers that only want to change
// the photo). PetPhoto stays a one-to-many table and all the photo
// endpoints are unchanged, so reintroducing a real gallery later is just a
// logic change here, no migration.
//
// Ordering matters for safety: the new file is uploaded and the DB
// committed to it FIRST; only once that succeeds is what was there before
// deleted (cleanupOldPhotoFiles, called after the caller's own transaction
// commits). That way a failure at any point before the commit leaves the
// old photo fully intact — the alternative order (delete old, then upload
// new) risks leaving the pet with no photo at all if the upload or DB
// write then fails. The final cleanup delete is best-effort
// (deletePrivateFile never throws) — a failure there leaves one orphaned
// object in the bucket, not a broken pet record.
const PLACEHOLDER_PHOTO = "placeholder.jpg";

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Uploads `file` to a fresh path and returns the Prisma write operations
// that point the pet's single PetPhoto row at it — the caller batches these
// into its own $transaction (updatePet also needs to write the pet's other
// field changes in that same transaction).
const preparePhotoReplacement = async (petID, file) => {
  const ext = EXT_BY_MIME[file.mimetype] || "jpg";
  const objectPath = `pets/${petID}/photo-${Date.now()}.${ext}`;

  await storage.uploadPrivateFile(
    storage.PET_IMAGES_BUCKET,
    objectPath,
    file.buffer,
    file.mimetype,
  );

  return {
    objectPath,
    operations: [
      prisma.petPhoto.deleteMany({ where: { petID } }),
      prisma.petPhoto.create({ data: { petID, photoURL: objectPath } }),
    ],
  };
};

// Deletes whatever photo(s) existed before a just-committed replacement —
// never the shared placeholder every photo-less pet points at (deleting it
// would break the fallback image for every other pet still using it).
const cleanupOldPhotoFiles = async (existing) => {
  const staleObjectPaths = new Set(existing.photos.map((p) => p.photoURL));
  if (existing.petPhoto !== PLACEHOLDER_PHOTO) {
    staleObjectPaths.add(existing.petPhoto);
  }
  await Promise.all(
    [...staleObjectPaths].map((photoURL) =>
      storage.deletePrivateFile(storage.PET_IMAGES_BUCKET, photoURL),
    ),
  );
};

// ——————————————— UPDATE PET (PUT /pets/:id) ———————————————
// `data` is already validated, whitelisted, and non-empty by the
// controller. shelterID reassignment is out of scope here (that's a
// transfer, not a profile edit) — Staff is scoped to their own shelter's
// pets only, Admin may edit any. `photoFile`, when present, replaces the
// pet's photo in the SAME transaction as the field updates — see the
// design note on preparePhotoReplacement above.
const updatePet = async (petID, data, { role, userID }, photoFile) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: {
      shelterID: true,
      petPhoto: true,
      photos: { select: { photoURL: true } },
    },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  if ("breedID" in data) {
    await assertBreedExists(data.breedID);
  }

  let newPhoto = null;
  if (photoFile) {
    newPhoto = await preparePhotoReplacement(petID, photoFile);
  }

  try {
    const operations = newPhoto ? [...newPhoto.operations] : [];
    operations.push(
      prisma.pet.update({
        where: { petID },
        data: newPhoto ? { ...data, petPhoto: newPhoto.objectPath } : data,
      }),
    );
    await prisma.$transaction(operations);
  } catch (err) {
    if (newPhoto) {
      await storage.deletePrivateFile(storage.PET_IMAGES_BUCKET, newPhoto.objectPath);
    }
    if (err.code === "P2025") {
      throw notFound(petID);
    }
    throw err;
  }

  if (newPhoto) {
    await cleanupOldPhotoFiles(existing);
  }

  return getPetDetails(petID);
};

// ——————————————— DELETE PET (DELETE /pets/:id) ———————————————
// Blocked while the pet has a Pending or Accepted application — those are
// the two non-terminal statuses (see the adoption-applications design
// notes elsewhere in this codebase); Rejected/Withdrawn don't block since
// they're already resolved. Photos are removed from Storage BEFORE the row
// itself, per spec — deletePrivateFile is best-effort/never-throws, so
// doing it first doesn't risk leaving the delete half-done if a Storage
// call fails.
const deletePet = async (petID, { role, userID }) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: {
      shelterID: true,
      photos: { select: { photoURL: true } },
    },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  const activeApplication = await prisma.adoptionApplication.findFirst({
    where: { petID, applicationStatus: { in: ["Pending", "Accepted"] } },
    select: { applicationID: true },
  });
  if (activeApplication) {
    throw activeApplicationConflict();
  }

  await Promise.all(
    existing.photos.map((photo) =>
      storage.deletePrivateFile(storage.PET_IMAGES_BUCKET, photo.photoURL),
    ),
  );

  try {
    await prisma.$transaction([
      prisma.petPhoto.deleteMany({ where: { petID } }),
      prisma.pet.delete({ where: { petID } }),
    ]);
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(petID);
    }
    throw err;
  }
};

// ——————————————— PHOTOS (POST/DELETE /pets/:id/photos) ———————————————
const photoNotFound = (photoID, petID) => {
  const err = new Error(`No photo with ID ${photoID} exists for pet ${petID}`);
  err.code = "NOT_FOUND";
  return err;
};

// The pet's full gallery, in upload order, each flagged against the pet's
// current primary (Pet.petPhoto) — there's no isPrimary column on PetPhoto
// itself, primary-ness is just "this row's URL happens to match
// Pet.petPhoto right now".
// isPrimary compares the RAW stored object paths (before the public-URL
// conversion below) — photo.photoURL and primaryPhotoURL are always both
// either bare Storage paths (new uploads) or both absolute seed URLs, so
// straight string equality holds either way.
const listPhotos = async (petID, primaryPhotoURL) => {
  const photos = await prisma.petPhoto.findMany({
    where: { petID },
    orderBy: { uploadedAt: "asc" },
    select: { photoID: true, photoURL: true, uploadedAt: true },
  });
  return photos.map((photo) => ({
    photoID: photo.photoID,
    photoURL: storage.toPublicFileUrl(storage.PET_IMAGES_BUCKET, photo.photoURL),
    uploadedAt: photo.uploadedAt,
    isPrimary: photo.photoURL === primaryPhotoURL,
  }));
};

// Standalone counterpart to updatePet's optional photoFile — for API
// callers that only want to change the photo, without also editing other
// fields. Same replace-not-add semantics and safe ordering; see
// preparePhotoReplacement/cleanupOldPhotoFiles's shared design note above.
// `file` is already validated by the controller (JPEG/PNG/WebP only,
// ≤5MB — the shared upload middleware allows a wider set, so the
// controller narrows it further for this endpoint specifically).
const addPhoto = async (petID, { role, userID }, { file }) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: {
      shelterID: true,
      petPhoto: true,
      photos: { select: { photoURL: true } },
    },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  const newPhoto = await preparePhotoReplacement(petID, file);

  try {
    await prisma.$transaction([
      ...newPhoto.operations,
      prisma.pet.update({ where: { petID }, data: { petPhoto: newPhoto.objectPath } }),
    ]);
  } catch (err) {
    // DB write failed after the new file landed — remove the orphaned object.
    await storage.deletePrivateFile(storage.PET_IMAGES_BUCKET, newPhoto.objectPath);
    throw err;
  }

  await cleanupOldPhotoFiles(existing);

  return listPhotos(petID, newPhoto.objectPath);
};

// Removes both the Storage object and the PetPhoto row. If the removed
// photo was the pet's primary, promotes the earliest remaining photo (if
// any) to primary, or falls back to the same placeholder used at pet
// creation (petPhoto is NOT NULL with no default, so it can never be left
// empty).
const deletePhoto = async (petID, photoID, { role, userID }) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: { shelterID: true, petPhoto: true },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  const photo = await prisma.petPhoto.findFirst({
    where: { photoID, petID },
    select: { photoID: true, photoURL: true },
  });
  if (!photo) {
    throw photoNotFound(photoID, petID);
  }

  await storage.deletePrivateFile(storage.PET_IMAGES_BUCKET, photo.photoURL);
  await prisma.petPhoto.delete({ where: { photoID: photo.photoID } });

  let primaryPhotoURL = existing.petPhoto;
  if (existing.petPhoto === photo.photoURL) {
    const nextPhoto = await prisma.petPhoto.findFirst({
      where: { petID },
      orderBy: { uploadedAt: "asc" },
      select: { photoURL: true },
    });
    primaryPhotoURL = nextPhoto?.photoURL ?? "placeholder.jpg";
    await prisma.pet.update({
      where: { petID },
      data: { petPhoto: primaryPhotoURL },
    });
  }

  return listPhotos(petID, primaryPhotoURL);
};

module.exports = {
  listMyShelterPets,
  getShelterPetDetail,
  getHealthPassport,
  createPet,
  updatePet,
  deletePet,
  getPhotos,
  addPhoto,
  deletePhoto,
};
