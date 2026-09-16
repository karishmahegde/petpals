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
 * /pets:
 *   post:
 *     summary: Create a new pet profile (Staff, Admin)
 *     description: >
 *       shelterID is taken from the acting staff member's own shelter and is
 *       never read from the request body for that role; Admin has no home
 *       shelter, so shelterID is required in the body instead. petPhoto
 *       starts as a placeholder — POST /pets/:id/photos supplies the real
 *       one. adoptionStatus always starts 'available'.
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
 *       (that's a transfer, not a profile edit).
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
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PetUpdate' }
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
 *         description: No updatable fields provided, invalid field, or breedID doesn't reference an existing breed
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
 */
router.put(
  "/pets/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  petsController.updatePet,
);

/**
 * @swagger
 * /pets/{id}:
 *   delete:
 *     summary: Delete a pet profile (Staff, Admin)
 *     description: >
 *       Staff may only delete pets at their own shelter; Admin may delete
 *       any. Blocked with 409 CONFLICT while the pet has a Pending or
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
 *         description: Staff attempting to delete a pet at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The pet has a Pending or Accepted adoption application
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
 *   post:
 *     summary: Upload a photo for a pet (Staff, Admin)
 *     description: >
 *       Staff may only upload to pets at their own shelter; Admin may act
 *       on any. A pet can have multiple photos — the first one ever
 *       uploaded automatically becomes the primary (Pet.petPhoto); any
 *       later upload can also be made primary by sending primary=true.
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
 *               primary: { type: string, enum: ["true", "false"] }
 *     responses:
 *       201:
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
 */
router.delete(
  "/pets/:id/photos/:photoId",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  petsController.deletePhoto,
);

module.exports = router;
