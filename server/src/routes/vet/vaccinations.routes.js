// What it does: Defines the vaccine catalog (GET /vaccines) and the doses
// given at an appointment (GET/POST /appointments/:id/vaccinations) —
// mounted at /api/v1 in app.js. Recording a dose is the appointment's
// assigned vet's; reading them is open to that vet, Staff at the
// appointment's shelter, and Admin.
const express = require("express");
const vaccinationsController = require("../../controllers/vet/vaccinations.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

const WORKER_ROLES = [ROLES.ADMIN, ROLES.STAFF, ROLES.VETERINARIAN];

/**
 * @swagger
 * /vaccines:
 *   get:
 *     summary: List the vaccine catalog, alphabetically (Admin, Staff, Veterinarian)
 *     tags: [Vaccines, Vets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Every vaccine, by vaccineName
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           vaccineID: { type: integer }
 *                           vaccineName: { type: string }
 *                           manufacturer: { type: string, nullable: true }
 *                           vaccineDesc: { type: string, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/vaccines",
  authenticate,
  authorizeRoles(...WORKER_ROLES),
  vaccinationsController.listVaccines,
);

/**
 * @swagger
 * /appointments/{id}/vaccinations:
 *   get:
 *     summary: List the doses given at an appointment (assigned Veterinarian, Staff at its shelter, Admin)
 *     description: >
 *       Oldest first. Another vet's appointment returns 404, exactly like a
 *       missing one; Staff at another shelter get 403.
 *     tags: [Vaccines, Vets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The appointment's doses
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/VaccinationDose' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   post:
 *     summary: Record a dose given at an appointment (assigned Veterinarian only)
 *     description: >
 *       petID, administeredBy (the caller), administeredAt (the
 *       appointment's shelter) and appointmentID are set server-side, never
 *       read from the body. Another vet's appointment returns 404, exactly
 *       like a missing one. Allowed at any status but Cancelled (409) —
 *       doses are often written up after the appointment is completed.
 *     tags: [Vaccines, Vets]
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
 *             required: [vaccineID, administeredDate, dueDate]
 *             properties:
 *               vaccineID: { type: integer }
 *               administeredDate: { type: string, format: date-time, description: Not in the future }
 *               dueDate: { type: string, format: date-time, description: After administeredDate — when the next dose is due }
 *     responses:
 *       201:
 *         description: The recorded dose
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/VaccinationDose' }
 *       400:
 *         description: Missing or malformed id, vaccineID, administeredDate or dueDate
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: No such appointment (or it's another vet's), or no such vaccineID
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: The appointment is Cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: administeredDate is in the future, or dueDate isn't after it
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/appointments/:id/vaccinations",
  authenticate,
  authorizeRoles(...WORKER_ROLES),
  vaccinationsController.listAppointmentVaccinations,
);
router.post(
  "/appointments/:id/vaccinations",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  vaccinationsController.recordVaccination,
);

module.exports = router;
