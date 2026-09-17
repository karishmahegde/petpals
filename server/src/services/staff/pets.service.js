const prisma = require("../../config/prisma");
const storage = require("../storage");
const {
  getPetDetails,
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

  const skip = (page - 1) * limit;
  const [pets, total] = await Promise.all([
    prisma.pet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { petID: "desc" },
      select: {
        petID: true,
        petName: true,
        petDOB: true,
        petPhoto: true,
        petSex: true,
        adoptionStatus: true,
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

// ——————————————— UPDATE PET (PUT /pets/:id) ———————————————
// `data` is already validated, whitelisted, and non-empty by the
// controller. shelterID reassignment is out of scope here (that's a
// transfer, not a profile edit) — Staff is scoped to their own shelter's
// pets only, Admin may edit any.
const updatePet = async (petID, data, { role, userID }) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: { shelterID: true },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  if ("breedID" in data) {
    await assertBreedExists(data.breedID);
  }

  try {
    await prisma.pet.update({ where: { petID }, data });
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(petID);
    }
    throw err;
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

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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

// `file` is already validated by the controller (JPEG/PNG/WebP only, ≤5MB —
// the shared upload middleware allows a wider set, so the controller narrows
// it further for this endpoint specifically). Becomes the pet's primary
// petPhoto if this is the pet's first photo ever, or if the caller passed
// makePrimary explicitly — otherwise it's just added to the gallery.
const addPhoto = async (petID, { role, userID }, { file, makePrimary }) => {
  const existing = await prisma.pet.findUnique({
    where: { petID },
    select: { shelterID: true, petPhoto: true, photos: { select: { photoID: true } } },
  });
  if (!existing) {
    throw notFound(petID);
  }

  await assertStaffOwnsShelter(role, userID, existing.shelterID);

  const isFirstPhoto = existing.photos.length === 0;
  const ext = EXT_BY_MIME[file.mimetype] || "jpg";
  const objectPath = `pets/${petID}/photo-${Date.now()}.${ext}`;

  await storage.uploadPrivateFile(
    storage.PET_IMAGES_BUCKET,
    objectPath,
    file.buffer,
    file.mimetype,
  );

  let primaryPhotoURL = existing.petPhoto;
  try {
    const operations = [
      prisma.petPhoto.create({ data: { petID, photoURL: objectPath } }),
    ];
    if (isFirstPhoto || makePrimary) {
      primaryPhotoURL = objectPath;
      operations.push(
        prisma.pet.update({ where: { petID }, data: { petPhoto: objectPath } }),
      );
    }
    await prisma.$transaction(operations);
  } catch (err) {
    // DB write failed after the file landed — remove the orphaned object.
    await storage.deletePrivateFile(storage.PET_IMAGES_BUCKET, objectPath);
    throw err;
  }

  return listPhotos(petID, primaryPhotoURL);
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
  createPet,
  updatePet,
  deletePet,
  getPhotos,
  addPhoto,
  deletePhoto,
};
