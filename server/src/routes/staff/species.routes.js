// What it does: Defines the Staff/Admin species & breed creation routes
// (POST /species, POST /breeds) — mounted at /api/v1 in app.js. The read
// side (GET /species, GET /breeds) stays public in routes/public/pets.routes.js.
const express = require("express");
const speciesController = require("../../controllers/staff/species.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /species:
 *   post:
 *     summary: Add a species (Staff, Admin)
 *     description: >
 *       speciesName is trimmed and must be unique, compared
 *       case-insensitively.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [speciesName]
 *             properties:
 *               speciesName: { type: string, maxLength: 45 }
 *     responses:
 *       201:
 *         description: The created species ({ speciesID, speciesName })
 *       400:
 *         description: speciesName missing, blank, or longer than 45 characters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: A species with that name already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/species",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  speciesController.createSpecies,
);

/**
 * @swagger
 * /breeds:
 *   post:
 *     summary: Add a breed to a species (Staff, Admin)
 *     description: >
 *       breedName is trimmed and must be unique within its species, compared
 *       case-insensitively. Returns the same shape as a GET /breeds item.
 *     tags: [Pets, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [speciesID, breedName]
 *             properties:
 *               speciesID: { type: integer, minimum: 1 }
 *               breedName: { type: string, maxLength: 45 }
 *     responses:
 *       201:
 *         description: The created breed ({ breedID, breedName, speciesName })
 *       400:
 *         description: Invalid speciesID, or breedName missing, blank, or longer than 45 characters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: That species already has a breed with that name
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/breeds",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  speciesController.createBreed,
);

module.exports = router;
