// Defines the /adoption-applications routes — mounted at /api/v1/adoption-applications in app.js
const express = require("express");
const controller = require("../../controllers/adopter/adoptionApplications.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /adoption-applications:
 *   post:
 *     summary: Submit an adoption application for a pet
 *     description: >
 *       The authenticated adopter applies for a specific pet. The application is
 *       created with applicationStatus = Pending. The pet must exist and be
 *       'available', and the adopter must not already have an active (Pending or
 *       Accepted) application for the same pet.
 *     tags: [Adoption Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petID, shelterID, applicationType]
 *             properties:
 *               petID:
 *                 type: integer
 *               shelterID:
 *                 type: integer
 *                 description: Must match the pet's shelter
 *               applicationType:
 *                 type: string
 *                 enum: [Adopt, Foster]
 *               shelterMessage:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *     responses:
 *       201:
 *         description: The created application record (applicationStatus = Pending)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdoptionApplication' }
 *       400:
 *         description: Missing/invalid petID or shelterID, or shelterID does not match the pet's shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Pet is not available, or the adopter already has an active application for it
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.createApplication,
);

/**
 * @swagger
 * /adoption-applications/{id}:
 *   get:
 *     summary: Get a single adoption application by ID
 *     description: >
 *       Adopters may only retrieve their own applications; staff may retrieve
 *       any. The response includes the pet name and shelter name.
 *     tags: [Adoption Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The application record, with nested pet.petName and shelter.shelterName
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdoptionApplicationDetail' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Role not permitted, or an adopter requesting another adopter's application
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/:id",
  authenticate,
  authorizeRoles(ROLES.ADOPTER, ROLES.STAFF),
  controller.getApplication,
);

module.exports = router;
