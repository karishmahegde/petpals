// What it does: Defines the vet's appointment routes — their own queue (GET
// /vets/me/appointments, GET /vets/me/appointments/:id; only appointments
// where vetID is the caller) and completing one (PATCH
// /appointments/:id/status). Mounted at /api/v1 in app.js. Plain
// authenticate, so a Pending (not yet approved) vet can't reach them.
const express = require("express");
const appointmentsController = require("../../controllers/vet/appointments.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /vets/me/appointments:
 *   get:
 *     summary: List the logged-in veterinarian's own appointments (Veterinarian only)
 *     description: >
 *       Only appointments where vetID is the caller. Same query params,
 *       paginated envelope and list-item shape as the Staff GET
 *       /appointments. upcoming=true scopes to Scheduled appointments with a
 *       future appointmentDate (soonest first); omitted/false scopes to
 *       everything else — past-dated or Cancelled (most recent first). A
 *       past Scheduled appointment is reported as Completed.
 *     tags: [Appointments, Vets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema: { type: string, enum: ["true", "false"], default: "false" }
 *       - in: query
 *         name: petName
 *         schema: { type: string }
 *         description: Case-insensitive contains match
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *         description: Optional inclusive lower bound on appointmentDate
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *         description: Optional inclusive upper bound on appointmentDate
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of appointments
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AppointmentQueueItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid upcoming, dateFrom, dateTo, page or limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/vets/me/appointments",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  appointmentsController.listMyAppointments,
);

/**
 * @swagger
 * /vets/me/appointments/{id}:
 *   get:
 *     summary: Get one of the logged-in veterinarian's appointments (Veterinarian only)
 *     description: >
 *       Pet (name, photo, species/breed, petCode), shelter, reason, status
 *       and the vaccine doses already linked to the appointment. Another
 *       vet's appointment returns 404, exactly like a missing one, so the
 *       response never confirms it exists.
 *     tags: [Appointments, Vets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The appointment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/VetAppointmentDetail' }
 *       400:
 *         description: id isn't a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/vets/me/appointments/:id",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  appointmentsController.getMyAppointment,
);

/**
 * @swagger
 * /appointments/{id}/status:
 *   patch:
 *     summary: Mark an appointment Completed (assigned Veterinarian only)
 *     description: >
 *       The only status a vet sets — cancelling stays the Staff-only PATCH
 *       /appointments/{id}/cancel. Only the vet assigned to the appointment
 *       — another vet's appointment returns 404, exactly like a missing one,
 *       so the response never confirms it exists. Only from a stored
 *       Scheduled status (409 for
 *       Cancelled or already Completed), and only once appointmentDate has
 *       passed (409 if it's still in the future). Optional notes become a
 *       HealthRecord for the pet, written in the same transaction.
 *     tags: [Appointments, Vets]
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
 *             required: [appointmentStatus]
 *             properties:
 *               appointmentStatus: { type: string, enum: [Completed] }
 *               notes: { type: string, maxLength: 500, description: Optional — creates a HealthRecord for the pet }
 *     responses:
 *       200:
 *         description: The completed appointment (same shape as GET /vets/me/appointments/{id})
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/VetAppointmentDetail' }
 *       400:
 *         description: Invalid id, appointmentStatus other than Completed, or notes too long
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: No such appointment, or it's assigned to another vet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Appointment is Cancelled or already Completed, or its date is still in the future
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/appointments/:id/status",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  appointmentsController.completeAppointment,
);

module.exports = router;
