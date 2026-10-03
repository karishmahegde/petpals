// What it does: Defines the vet's pet routes — the pets at their own shelter
// (GET /vets/me/pets, /vets/me/pets/:id, /vets/me/pets/:id/health-passport)
// and their health notes (POST /pets/:id/health-records, PUT
// /health-records/:id). Mounted at /api/v1 in app.js. The detail and
// passport reuse the Staff controller handlers (same shapes as
// /staff/me/pets/:id and its health-passport); staff/pets.service.js scopes
// a Veterinarian to their own shelter, answering 404 for a pet elsewhere.
const express = require("express");
const vetPetsController = require("../../controllers/vet/pets.controller");
const staffPetsController = require("../../controllers/staff/pets.controller");
const healthRecordsController = require("../../controllers/vet/healthRecords.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /vets/me/pets:
 *   get:
 *     summary: List the pets at the logged-in veterinarian's shelter (Veterinarian only)
 *     description: >
 *       Same query params and list-item shape as GET /staff/me/pets
 *       (adoptionStatus, species, breed, size, minAge, maxAge, sort, page,
 *       limit), plus petName — a case-insensitive contains match, as on
 *       GET /appointments.
 *     tags: [Pets, Vets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: petName
 *         schema: { type: string }
 *       - in: query
 *         name: adoptionStatus
 *         schema: { type: string, enum: [incoming, available, adopted, fostered, transferred, deceased] }
 *       - in: query
 *         name: species
 *         schema: { type: array, items: { type: integer, minimum: 1 } }
 *         style: form
 *         explode: true
 *       - in: query
 *         name: breed
 *         schema: { type: array, items: { type: string } }
 *         style: form
 *         explode: true
 *       - in: query
 *         name: size
 *         schema: { type: array, items: { type: string, enum: [Small, Medium, Large] } }
 *         style: form
 *         explode: true
 *       - in: query
 *         name: minAge
 *         schema: { type: integer, minimum: 0 }
 *       - in: query
 *         name: maxAge
 *         schema: { type: integer, minimum: 0 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: A page of pets (same shape as GET /staff/me/pets)
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/vets/me/pets",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  vetPetsController.listMyShelterPets,
);

/**
 * @swagger
 * /vets/me/pets/{id}:
 *   get:
 *     summary: Get a pet at the logged-in veterinarian's shelter (Veterinarian only)
 *     description: >
 *       Same shape as GET /staff/me/pets/{id}. A pet at another shelter
 *       returns 404, exactly like a missing one.
 *     tags: [Pets, Vets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pet
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/vets/me/pets/:id",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  staffPetsController.getShelterPetDetail,
);

/**
 * @swagger
 * /vets/me/pets/{id}/health-passport:
 *   get:
 *     summary: Get the health passport of a pet at the logged-in veterinarian's shelter (Veterinarian only)
 *     description: >
 *       Same shape as GET /staff/me/pets/{id}/health-passport, from the same
 *       service. The passport is universal: health records, vaccinations and
 *       transfer history are read by pet, never by shelter, so it includes
 *       everything recorded at shelters the pet was transferred out of. A
 *       pet at another shelter returns 404, exactly like a missing one.
 *     tags: [Pets, Vets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pet's health passport
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/HealthPassport' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/vets/me/pets/:id/health-passport",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  staffPetsController.getHealthPassport,
);

/**
 * @swagger
 * /pets/{id}/health-records:
 *   post:
 *     summary: Add a standalone health note for a pet (Veterinarian only)
 *     description: >
 *       vetID is always the caller. The pet must be at the vet's own shelter
 *       (403 otherwise). Shows on the pet's Health Passport.
 *     tags: [Health Records, Vets]
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
 *           schema:
 *             type: object
 *             required: [recordDesc]
 *             properties:
 *               recordDesc: { type: string, maxLength: 500 }
 *     responses:
 *       201:
 *         description: The created record (Health Passport healthRecords item shape, plus petID and lastUpdated)
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not a Veterinarian, or the pet isn't at the vet's shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  "/pets/:id/health-records",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  healthRecordsController.createHealthRecord,
);

/**
 * @swagger
 * /health-records/{id}:
 *   put:
 *     summary: Edit a health note (the Veterinarian who wrote it only)
 *     description: >
 *       Only recordDesc is editable. Only the vet who wrote the record —
 *       including notes written when completing an appointment — may edit
 *       it (403 otherwise).
 *     tags: [Health Records, Vets]
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
 *           schema:
 *             type: object
 *             required: [recordDesc]
 *             properties:
 *               recordDesc: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: The updated record
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not a Veterinarian, or not the vet who wrote this record
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  "/health-records/:id",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  healthRecordsController.updateHealthRecord,
);

module.exports = router;
