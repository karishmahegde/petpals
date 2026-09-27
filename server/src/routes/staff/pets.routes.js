// What it does: Defines the Staff/Admin pet-management routes (POST /pets,
// PUT /pets/:id) — mounted at /api/v1 in app.js, alongside (not instead of)
// the public read-only /pets routes in routes/public/pets.routes.js.
// Different HTTP methods on the same path never collide regardless of mount
// order, unlike the /staff/me vs /staff/:id situation in
// routes/staff/staff.routes.js.
const express = require("express");
const petsController = require("../../controllers/staff/pets.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const { singleFile } = require("../../middleware/upload");
const router = express.Router();

/**
 * @swagger
 * /staff/me/pets:
 *   get:
 *     summary: List the staff member's own shelter's pets (Staff)
 *     description: >
 *       Unlike the public GET /pets (hardcoded to adoptionStatus=available
 *       for the catalog), this returns every pet at the staff member's
 *       shelter regardless of status, optionally filtered to one status.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: adoptionStatus
 *         schema: { type: string, enum: [incoming, available, adopted, fostered, transferred, deceased] }
 *       - in: query
 *         name: species
 *         schema: { type: array, items: { type: integer, minimum: 1 } }
 *         style: form
 *         explode: true
 *         description: Repeatable speciesID filter — same convention as public GET /pets
 *       - in: query
 *         name: breed
 *         schema: { type: array, items: { type: string } }
 *         style: form
 *         explode: true
 *         description: Repeatable breedName filter — same convention as public GET /pets
 *       - in: query
 *         name: size
 *         schema: { type: array, items: { type: string, enum: [Small, Medium, Large] } }
 *         style: form
 *         explode: true
 *       - in: query
 *         name: minAge
 *         schema: { type: integer, minimum: 0 }
 *         description: Minimum age in MONTHS (inclusive)
 *       - in: query
 *         name: maxAge
 *         schema: { type: integer, minimum: 0 }
 *         description: Maximum age in MONTHS (inclusive)
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest] }
 *         description: >
 *           Omit for the existing default order (petID descending).
 *           'newest' orders by intakeDate descending — powers the Staff
 *           Overview New Arrivers widget
 *           (?adoptionStatus=incoming&sort=newest&limit=5).
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: >
 *           Paginated list of the shelter's pets, in the same
 *           petID/petName/petAge/petSex/petPhoto/breed shape as public GET
 *           /pets, plus adoptionStatus (which that public shape omits).
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid adoptionStatus value
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: The staff member has no shelter assigned yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/staff/me/pets",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  petsController.listMyShelterPets,
);

/**
 * @swagger
 * /staff/me/pets/{id}:
 *   get:
 *     summary: Full detail for one of the staff member's own shelter's pets (Staff)
 *     description: >
 *       Richer than public GET /pets/:id — adds petCode, microchipID,
 *       petSize, petBGroup, intakeDate, intakeType, featuredFlag, and the
 *       raw petDOB (the public shape only returns the formatted petAge).
 *       Powers the Pets tab's read-only detail view and pre-fills the edit
 *       form with real values.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pet's full detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/staff/me/pets/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  petsController.getShelterPetDetail,
);

/**
 * @swagger
 * /staff/me/pets/{id}/health-passport:
 *   get:
 *     summary: Full health passport for one of the staff member's own shelter's pets (Staff)
 *     description: >
 *       Combines the pet's own detail (same shape as GET
 *       /staff/me/pets/:id) with its full HealthRecord/VaccinationRecord
 *       history and its complete cross-shelter TransferHistory — the
 *       transfer history is NOT scoped to the caller's own shelter, since a
 *       passport is meant to show the pet's full network-wide history
 *       regardless of which shelter currently holds it. Each vaccination
 *       gets a computed status (Overdue/Due Soon/Up to Date) based on how
 *       close its dueDate is.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pet's full health passport
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/HealthPassport' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/staff/me/pets/:id/health-passport",
  authenticate,
  authorizeRoles(ROLES.STAFF),
  petsController.getHealthPassport,
);

/**
 * @swagger
 * /pets:
 *   post:
 *     summary: Create a new pet profile (Staff, Admin)
 *     description: >
 *       shelterID is taken from the acting staff member's own shelter and is
 *       never read from the request body for that role; Admin has no home
 *       shelter, so shelterID is required in the body instead. petPhoto
 *       starts as a placeholder — POST /pets/:id/photos supplies the real
 *       one. adoptionStatus is optional and defaults to 'incoming' (kept out of
 *       the public catalog until staff mark it 'available').
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PetCreate' }
 *     responses:
 *       201:
 *         description: The created pet, in the same shape as public GET /pets/:id
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/PetDetail' }
 *       400:
 *         description: Missing/invalid field, breedID doesn't reference an existing breed, or (Admin) shelterID doesn't reference an existing shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: A Staff caller has no shelter assigned yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/pets",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  petsController.createPet,
);

/**
 * @swagger
 * /pets/{id}:
 *   put:
 *     summary: Update a pet's full profile (Staff, Admin)
 *     description: >
 *       Partial update — only fields present in the body are changed.
 *       Staff may only edit pets at their own shelter (403 otherwise);
 *       Admin may edit any pet. shelterID reassignment is out of scope
 *       (that's a transfer, not a profile edit). Multipart, not JSON — an
 *       optional `file` field replaces the pet's photo (v1 is one photo per
 *       pet, not a gallery) in the same request/transaction as the field
 *       changes; omit it to leave the photo untouched.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/PetUpdate'
 *               - type: object
 *                 properties:
 *                   file: { type: string, format: binary, description: Optional — replaces the pet's photo }
 *     responses:
 *       200:
 *         description: The updated pet, in the same shape as public GET /pets/:id
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/PetDetail' }
 *       400:
 *         description: No updatable fields provided, invalid field (including adoptionStatus 'adopted'/'transferred', which only the adoption/transfer workflows set), an unsupported photo file type, or breedID doesn't reference an existing breed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to edit a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The pet is mid-transfer (read-only), or adopted and the update touches anything other than adoptionStatus (an adopted pet's status alone may be changed)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put(
  "/pets/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  singleFile("file"),
  petsController.updatePet,
);

/**
 * @swagger
 * /pets/{id}:
 *   delete:
 *     summary: Delete a pet profile (shelter Manager, Admin)
 *     description: >
 *       Staff must be the manager of the pet's shelter
 *       (Shelter.managerStaffID); Admin may delete any. Blocked with 409 CONFLICT while the pet has a Pending or
 *       Accepted adoption application. Removes photos from the pet-images
 *       Storage bucket before removing the row.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pet deleted successfully
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to delete a pet at another shelter, or who isn't that shelter's manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The pet has a Pending or Accepted adoption application, or is adopted/mid-transfer (adoptionStatus 'adopted'/'transferred')
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete(
  "/pets/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  petsController.deletePet,
);

/**
 * @swagger
 * /pets/{id}/photos:
 *   get:
 *     summary: List a pet's photos (Staff, Admin)
 *     description: >
 *       Read-only counterpart to POST/DELETE .../photos — lets the pet
 *       detail view load the current gallery without an upload/delete
 *       round trip first. Staff may only view pets at their own shelter.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pet's full photo list, each flagged with isPrimary
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/PetPhoto' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view photos of a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/pets/:id/photos",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  petsController.getPhotos,
);

/**
 * @swagger
 * /pets/{id}/photos:
 *   post:
 *     summary: Upload a photo for a pet (Staff, Admin)
 *     description: >
 *       v1 supports exactly one photo per pet, not a gallery — this REPLACES
 *       whatever photo the pet had before (both the old Storage object and
 *       its PetPhoto row are removed once the new one is safely committed).
 *       Staff may only upload to pets at their own shelter; Admin may act on
 *       any.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: The pet's photo list (0 or 1 item in v1), each flagged with isPrimary
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/PetPhoto' }
 *       400:
 *         description: Missing file or an unsupported file type (only JPEG/PNG/WebP allowed here)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to upload to a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The pet is adopted or mid-transfer (adoptionStatus 'adopted'/'transferred') — read-only, only the adoption/transfer workflow changes it
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/pets/:id/photos",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  singleFile("file"),
  petsController.addPhoto,
);

/**
 * @swagger
 * /pets/{id}/photos/{photoId}:
 *   delete:
 *     summary: Remove a pet's photo (Staff, Admin)
 *     description: >
 *       Removes both the Storage object and its DB row. If the removed
 *       photo was the pet's primary, the earliest remaining photo (if any)
 *       is promoted to primary automatically.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pet's remaining photo list, each flagged with isPrimary
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/PetPhoto' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to delete a photo at another shelter's pet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: The pet doesn't exist, or the photo doesn't exist/belong to this pet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: The pet is adopted or mid-transfer (adoptionStatus 'adopted'/'transferred') — read-only, only the adoption/transfer workflow changes it
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete(
  "/pets/:id/photos/:photoId",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  petsController.deletePhoto,
);

module.exports = router;
