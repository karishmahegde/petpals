// What it does: Defines the volunteer's read-only view of their shelter's
// events (GET /volunteers/me/events). Volunteers don't sign themselves up —
// staff assign them (POST /events, PUT /events/:id volunteerIDs); this list
// just shows every event at the volunteer's shelter and which ones they're
// on. Mounted at /api/v1 in app.js. Plain authenticate: Pending → 401.
const express = require("express");
const eventsController = require("../../controllers/volunteer/events.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /volunteers/me/events:
 *   get:
 *     summary: List every event at the logged-in volunteer's shelter (Volunteer only)
 *     description: >
 *       Read-only. Same item shape as the public GET /events, plus
 *       `assigned` — whether staff have put this volunteer on the event
 *       (only their own assignment is shown, never who else is on it).
 *       upcoming=true → not started yet, soonest first; upcoming=false →
 *       already started, most recent first; omitted → every event, soonest
 *       first. assigned=true → only events the volunteer is on. dateTo
 *       (inclusive) caps the event date — with upcoming=true, events
 *       between now and dateTo.
 *     tags: [Events, Volunteers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: assigned
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of the shelter's events
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
 *                         allOf:
 *                           - $ref: '#/components/schemas/EventListItem'
 *                           - type: object
 *                             properties:
 *                               assigned: { type: boolean }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/volunteers/me/events",
  authenticate,
  authorizeRoles(ROLES.VOLUNTEER),
  eventsController.listMyShelterEvents,
);

module.exports = router;
