// What it does: Defines the volunteer's read-only list of the vet
// appointments they're assigned to assist (GET /volunteers/me/appointments,
// Appointment.volunteerID = caller). Mounted at /api/v1 in app.js. Plain
// authenticate: Pending → 401.
const express = require("express");
const appointmentsController = require("../../controllers/volunteer/appointments.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /volunteers/me/appointments:
 *   get:
 *     summary: List the vet appointments the logged-in volunteer is assisting (Volunteer only)
 *     description: >
 *       Read-only — staff assign a volunteer when creating or editing an
 *       appointment. Same list-item shape, status labels (a past Scheduled
 *       appointment reads Completed) and split as GET /vets/me/appointments:
 *       upcoming=true → Scheduled and still ahead, soonest first;
 *       upcoming=false (default) → past or Cancelled, most recent first.
 *     tags: [Appointments, Volunteers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema: { type: string, enum: ["true", "false"], default: "false" }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
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
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/volunteers/me/appointments",
  authenticate,
  authorizeRoles(ROLES.VOLUNTEER),
  appointmentsController.listMyAppointments,
);

module.exports = router;
