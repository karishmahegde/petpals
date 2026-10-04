// What it does: Defines a volunteer's own task routes — the tasks they're
// assigned to (GET /volunteers/me/tasks) and marking one done (PATCH
// /volunteers/me/tasks/:id/status). Mounted at /api/v1 in app.js. Plain
// authenticate: a Pending volunteer has no tasks to see yet (401).
const express = require("express");
const tasksController = require("../../controllers/volunteer/tasks.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /volunteers/me/tasks:
 *   get:
 *     summary: List the tasks the logged-in volunteer is assigned to (Volunteer only)
 *     description: >
 *       Same item shape and derived status (Overdue for an In_progress task
 *       past its due date) as the Staff GET /tasks. upcoming=true → due now
 *       or later (or no due date), soonest first; upcoming=false → due date
 *       passed, most recent first; omitted → every task, soonest due first.
 *     tags: [Tasks, Volunteers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: taskStatus
 *         schema: { type: string, enum: [In_progress, Completed, Cancelled] }
 *       - in: query
 *         name: upcoming
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of the volunteer's tasks
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Task' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/volunteers/me/tasks",
  authenticate,
  authorizeRoles(ROLES.VOLUNTEER),
  tasksController.listMyTasks,
);

/**
 * @swagger
 * /volunteers/me/tasks/{id}/status:
 *   patch:
 *     summary: Mark one of the logged-in volunteer's tasks Completed (Volunteer only)
 *     description: >
 *       Body { taskStatus: "Completed" } — the only transition a volunteer
 *       makes (cancelling is staff's, PATCH /tasks/{id}/status). A task the
 *       volunteer isn't assigned to is 404, exactly like a missing one. Only
 *       an In_progress task (overdue included) can be completed — 409
 *       otherwise.
 *     tags: [Tasks, Volunteers]
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
 *             required: [taskStatus]
 *             properties:
 *               taskStatus: { type: string, enum: [Completed] }
 *     responses:
 *       200:
 *         description: The completed task
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The task is already Completed or Cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/volunteers/me/tasks/:id/status",
  authenticate,
  authorizeRoles(ROLES.VOLUNTEER),
  tasksController.completeMyTask,
);

module.exports = router;
