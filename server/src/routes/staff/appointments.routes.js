// What it does: Defines the Staff/Admin vet-appointment routes (POST
// /appointments, GET /appointments, GET /appointments/:id, PATCH
// /appointments/:id/cancel) — mounted at /api/v1 in app.js. No adopter-facing
// write surface exists — adopters only ever read their own pets' appointments
// via /adopters/me/appointments (routes/adopter/adopters.routes.js).
const express = require("express");
const appointmentsController = require("../../controllers/staff/appointments.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Create a vet appointment (Staff, Admin)
 *     description: >
 *       shelterID is taken from the acting staff member's own shelter and is
 *       never read from the request body for that role; Admin has no home
 *       shelter, so shelterID is required in the body instead. petID must
 *       belong to that shelter, vetID must be an Active vet at that shelter,
 *       and volunteerID (optional) must be a volunteer at that shelter.
 *       appointmentDate must not be in the past. staffID (optional) must be
 *       an Active staff member at that shelter; omitted, it defaults to the
 *       acting Staff member (null for an Admin actor).
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petID, vetID, appointmentDate, appointmentReason]
 *             properties:
 *               petID: { type: integer }
 *               vetID: { type: integer }
 *               volunteerID: { type: integer, description: Optional }
 *               staffID: { type: integer, description: Optional — defaults to the acting Staff member }
 *               appointmentDate: { type: string, format: date-time, description: Must not be in the past }
 *               appointmentReason: { type: string, maxLength: 300 }
 *               shelterID: { type: integer, description: Admin only — required for that role }
 *     responses:
 *       201:
 *         description: The created appointment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AppointmentDetail' }
 *       400:
 *         description: Missing/invalid field, or petID/vetID/volunteerID/staffID don't belong to the resolved shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: A Staff caller has no shelter assigned yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/appointments",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.createAppointment,
);

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: List appointments at the caller's shelter (Staff, Admin)
 *     description: >
 *       upcoming=true scopes to Scheduled appointments with a future
 *       appointmentDate (the "Upcoming Appointments" section); omitted/false
 *       scopes to everything else — past-dated or Cancelled (the "Past
 *       Appointments" section). Staff is always scoped to their own shelter,
 *       resolved server-side; Admin may pass an explicit shelterID or omit
 *       it for a network-wide list.
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: vetID
 *         schema: { type: integer }
 *       - in: query
 *         name: petName
 *         schema: { type: string }
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer, description: Admin only }
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
 *       400:
 *         description: Missing/invalid query param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/appointments",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.listAppointments,
);

/**
 * @swagger
 * /appointments/vets:
 *   get:
 *     summary: List this shelter's active vets (Staff, Admin)
 *     description: >
 *       Minimal roster for the appointment form's/filter bar's dropdowns —
 *       not a general vet-management API. Staff is scoped to their own
 *       shelter; Admin must pass shelterID explicitly.
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer, description: Required for Admin }
 *     responses:
 *       200:
 *         description: Active vets at the shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *       400:
 *         description: shelterID missing/invalid (Admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/appointments/vets",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.listVets,
);

/**
 * @swagger
 * /appointments/volunteers:
 *   get:
 *     summary: List this shelter's active volunteers (Staff, Admin)
 *     description: >
 *       Minimal roster for the appointment form's optional volunteer
 *       dropdown — not a general volunteer-management API. Staff is scoped
 *       to their own shelter; Admin must pass shelterID explicitly.
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer, description: Required for Admin }
 *     responses:
 *       200:
 *         description: Active volunteers at the shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *       400:
 *         description: shelterID missing/invalid (Admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/appointments/volunteers",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.listVolunteers,
);

/**
 * @swagger
 * /appointments/staff:
 *   get:
 *     summary: List this shelter's active staff (Staff, Admin)
 *     description: >
 *       Minimal roster for the appointment form's staff dropdown — not a
 *       general staff-management API. Staff is scoped to their own shelter;
 *       Admin must pass shelterID explicitly.
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer, description: Required for Admin }
 *     responses:
 *       200:
 *         description: Active staff at the shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *       400:
 *         description: shelterID missing/invalid (Admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/appointments/staff",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.listStaff,
);

/**
 * @swagger
 * /appointments/{id}:
 *   get:
 *     summary: Get one appointment's full detail (Staff, Admin)
 *     description: >
 *       Staff may only view an appointment at their own shelter; Admin may
 *       view any. Includes the vaccines administered at this appointment
 *       (vaccination records linked to it) and the pet's current adopter, if
 *       it has an Accepted application.
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The appointment's full detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AppointmentDetail' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view an appointment at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/appointments/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.getAppointment,
);

/**
 * @swagger
 * /appointments/{id}:
 *   patch:
 *     summary: Edit a Scheduled, upcoming appointment (Staff, Admin)
 *     description: >
 *       Partial update — send only the fields that change. Only a Scheduled
 *       appointment whose date hasn't passed can be edited. petID, shelterID
 *       and status are not editable (400 if sent). vetID/staffID must be
 *       active at the appointment's shelter; volunteerID may be null to
 *       unassign. The same pet+vet+time double-booking guard as create
 *       applies (409), excluding this appointment itself.
 *     tags: [Appointments, Staff]
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
 *             properties:
 *               vetID: { type: integer }
 *               staffID: { type: integer }
 *               volunteerID: { type: integer, nullable: true }
 *               appointmentDate: { type: string, format: date-time }
 *               appointmentReason: { type: string, maxLength: 300 }
 *     responses:
 *       200:
 *         description: The updated appointment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AppointmentDetail' }
 *       400:
 *         description: Invalid/locked/no fields, past date, or a vet/staff/volunteer not at this shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to edit an appointment at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The appointment is no longer Scheduled/upcoming, or the new slot is already booked
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/appointments/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.updateAppointment,
);

/**
 * @swagger
 * /appointments/{id}/cancel:
 *   patch:
 *     summary: Cancel a Scheduled, upcoming appointment (Staff, Admin)
 *     description: >
 *       Only a Scheduled appointment whose date hasn't passed can be
 *       cancelled. Staff may only cancel an appointment at their own
 *       shelter; Admin may cancel any.
 *     tags: [Appointments, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The cancelled appointment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AppointmentDetail' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to cancel an appointment at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The appointment is no longer Scheduled/upcoming
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/appointments/:id/cancel",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  appointmentsController.cancelAppointment,
);

module.exports = router;
