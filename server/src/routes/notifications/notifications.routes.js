// What it does: Defines the logged-in user's own in-app notifications — the
// list, the unread count and marking them read. Mounted at /api/v1 in app.js.
// Every role, plain authenticate: a Pending user has no dashboard (and so no
// bell) yet.
const express = require("express");
const notificationsController = require("../../controllers/notifications/notifications.controller");
const authenticate = require("../../middleware/authenticate");
const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List the logged-in user's notifications (every role)
 *     description: >
 *       Newest first. unread=true → unread only; unread=false or omitted →
 *       everything. The response carries unreadCount (the user's total,
 *       whatever the filter or page) next to pagination, so the bell's badge
 *       and the list come from one request. Each call also deletes the user's
 *       read notifications older than 90 days; unread ones are kept.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unread
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated list of the user's notifications
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Notification' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *                     unreadCount: { type: integer, example: 3 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   patch:
 *     summary: Mark all of the logged-in user's notifications read (every role)
 *     description: >
 *       Body { read: true } — the only value accepted (marking everything
 *       unread isn't offered). The user's other open tabs get the new count
 *       on their live stream.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [read]
 *             properties:
 *               read: { type: boolean, enum: [true] }
 *     responses:
 *       200:
 *         description: How many were marked, and the new unread count (0)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         updated: { type: integer, example: 4 }
 *                         unreadCount: { type: integer, example: 0 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/notifications", authenticate, notificationsController.listNotifications);
router.patch("/notifications", authenticate, notificationsController.markAllRead);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: How many unread notifications the logged-in user has (every role)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The unread count
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         unreadCount: { type: integer, example: 3 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/notifications/unread-count",
  authenticate,
  notificationsController.getUnreadCount,
);

/**
 * @swagger
 * /notifications/stream:
 *   get:
 *     summary: Live stream of the logged-in user's notifications (every role)
 *     description: >
 *       Server-Sent Events, held open. Auth is the normal Authorization
 *       Bearer header, so read it with fetch streaming rather than
 *       EventSource (which can't send headers). Events — each an `event:`
 *       line plus one JSON `data:` line: `unread-count` { unreadCount } on
 *       connect and after a mark-read in any tab; `notification` (a
 *       Notification) when one arrives; `token-expired` {} just before the
 *       stream ends at the access token's expiry — refresh the token and
 *       reconnect. A `: heartbeat` comment comes every 25 seconds. The stream
 *       is a nudge, not the record: refetch GET /notifications on every
 *       reconnect to pick up anything sent while disconnected. Swagger UI
 *       can't display a stream that doesn't end; use curl -N to try it.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The event stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: "event: unread-count\ndata: {\"unreadCount\":3}\n\n"
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/notifications/stream", authenticate, notificationsController.streamNotifications);

/**
 * @swagger
 * /notifications/{id}:
 *   patch:
 *     summary: Mark one of the logged-in user's notifications read or unread (every role)
 *     description: >
 *       Body { read: true | false }. Marking an already-read notification read
 *       keeps its first readAt. Another user's notification is 404, exactly
 *       like a missing one. The user's other open tabs get the new count on
 *       their live stream.
 *     tags: [Notifications]
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
 *             required: [read]
 *             properties:
 *               read: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated notification and the new unread count
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         notification: { $ref: '#/components/schemas/Notification' }
 *                         unreadCount: { type: integer, example: 2 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch("/notifications/:id", authenticate, notificationsController.markNotification);

module.exports = router;
