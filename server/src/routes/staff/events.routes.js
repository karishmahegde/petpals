// What it does: Defines the Staff/Admin event-management routes (POST
// /events, PUT /events/:id, DELETE /events/:id) — mounted at /api/v1 in
// app.js, alongside (not instead of) the public read-only /events routes in
// routes/public/events.routes.js. Different HTTP methods on the same path
// never collide regardless of mount order, same precedent as
// routes/staff/pets.routes.js and routes/public/pets.routes.js.
const express = require("express");
const eventsController = require("../../controllers/staff/events.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a shelter event (Staff, Admin)
 *     description: >
 *       shelterID is taken from the acting staff member's own shelter and is
 *       never read from the request body for that role; Admin has no home
 *       shelter, so shelterID is required in the body instead. eventDate
 *       must not be in the past.
 *     tags: [Events, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventName, eventDesc, eventDate, eventCategory]
 *             properties:
 *               eventName: { type: string, maxLength: 45 }
 *               eventDesc: { type: string, maxLength: 300 }
 *               eventCategory: { type: string, enum: [Adoption_Event, Fundraiser, Volunteer_Orientation, Vaccination_Clinic, Community_Outreach, Workshop, Donation_Drive, Other] }
 *               eventDate: { type: string, format: date-time, description: Must not be in the past }
 *               shelterID: { type: integer, description: Admin only — required for that role }
 *     responses:
 *       201:
 *         description: The created event, in the same shape as public GET /events/:id
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/EventDetail' }
 *       400:
 *         description: Missing/invalid field, eventDate in the past, or (Admin) shelterID doesn't reference an existing shelter
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
  "/events",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  eventsController.createEvent,
);

/**
 * @swagger
 * /events/{id}:
 *   put:
 *     summary: Update an event (Staff, Admin)
 *     description: >
 *       Partial update — only fields present in the body are changed. Staff
 *       may only edit events at their own shelter (403 otherwise); Admin may
 *       edit any event. shelterID reassignment is out of scope.
 *     tags: [Events, Staff]
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
 *               eventName: { type: string, maxLength: 45 }
 *               eventDesc: { type: string, maxLength: 300 }
 *               eventCategory: { type: string, enum: [Adoption_Event, Fundraiser, Volunteer_Orientation, Vaccination_Clinic, Community_Outreach, Workshop, Donation_Drive, Other] }
 *               eventDate: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: The updated event, in the same shape as public GET /events/:id
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/EventDetail' }
 *       400:
 *         description: No updatable fields provided, or an invalid field
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to edit an event at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  "/events/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  eventsController.updateEvent,
);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete an event (Staff, Admin)
 *     description: >
 *       Staff may only delete events at their own shelter (403 otherwise);
 *       Admin may delete any event. Volunteer signups for this event are
 *       removed along with it.
 *     tags: [Events, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to delete an event at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete(
  "/events/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  eventsController.deleteEvent,
);

module.exports = router;
