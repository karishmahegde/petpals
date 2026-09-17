// What it does: Defines the /events routes — mounted at /api/v1 in app.js.
// No auth required, same convention as /pets and /shelters.
const express = require("express");
const eventsController = require("../../controllers/public/events.controller");
const router = express.Router();

/**
 * @swagger
 * /events:
 *   get:
 *     summary: List shelter events, network-wide or scoped to one shelter
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of events, ordered by eventDate ascending
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/EventListItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid page/limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/events", eventsController.getEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Full detail for one event, including shelter name/address
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The event detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/EventDetail' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/events/:id", eventsController.getEventDetails);

module.exports = router;
