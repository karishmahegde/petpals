// What it does: Defines the Staff/Admin volunteer-task routes (GET /tasks,
// GET /tasks/:id, POST /tasks, PATCH /tasks/:id, PATCH /tasks/:id/status) —
// mounted at /api/v1 in app.js. Staff is always scoped to their own shelter.
const express = require("express");
const tasksController = require("../../controllers/staff/tasks.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: List volunteer tasks at the caller's shelter (Staff, Admin)
 *     description: >
 *       Sorted by due date. dueFrom/dueTo bound taskDue (the client computes
 *       them so "today"/"this week" follow its own timezone); overdue=true
 *       returns only In_progress tasks past due and overrides dueFrom/dueTo.
 *       volunteerName matches any assigned volunteer. Each item's `status` is
 *       taskStatus, or "Overdue" for an In_progress task past due.
 *     tags: [Tasks, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: taskStatus
 *         schema: { type: string, enum: [In_progress, Completed, Cancelled] }
 *       - in: query
 *         name: dueFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dueTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: overdue
 *         schema: { type: boolean }
 *       - in: query
 *         name: volunteerName
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
 *         description: Paginated list of tasks
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
 *       400:
 *         description: Invalid taskStatus, date, shelterID, or pagination param
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: Create a task and assign it to volunteers (Staff, Admin)
 *     description: >
 *       Staff creates at their own shelter; Admin must pass shelterID. Every
 *       volunteer must be Active at that shelter. taskDate is set to now and
 *       staffID to the acting staff member.
 *     tags: [Tasks, Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskName, taskDesc, taskDue, volunteerIDs]
 *             properties:
 *               taskName: { type: string, enum: [Animal_Care, Vet_Assistance, Cleaning, Feeding, Events, Admin, Other] }
 *               taskDesc: { type: string, maxLength: 300 }
 *               taskDue: { type: string, format: date-time, description: Must not be in the past }
 *               volunteerIDs: { type: array, items: { type: integer }, minItems: 1 }
 *               shelterID: { type: integer, description: Admin only — required for that role }
 *     responses:
 *       201:
 *         description: The created task
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: Missing/invalid field, past due date, or a volunteer not active at this shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: Staff has no shelter assigned yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/tasks",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  tasksController.listTasks,
);
router.post(
  "/tasks",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  tasksController.createTask,
);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get one task (Staff, Admin)
 *     description: Staff may only view tasks at their own shelter; Admin may view any.
 *     tags: [Tasks, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The task
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: id is not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to view a task at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     summary: Edit an open task (Staff, Admin)
 *     description: >
 *       In_progress tasks only (409 otherwise). Partial — send only what
 *       changes; volunteerIDs replaces the whole assignee set.
 *     tags: [Tasks, Staff]
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
 *               taskName: { type: string, enum: [Animal_Care, Vet_Assistance, Cleaning, Feeding, Events, Admin, Other] }
 *               taskDesc: { type: string, maxLength: 300 }
 *               taskDue: { type: string, format: date-time, description: Must not be in the past }
 *               volunteerIDs: { type: array, items: { type: integer }, minItems: 1 }
 *     responses:
 *       200:
 *         description: The updated task
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: Invalid/no fields, past due date, or a volunteer not active at this shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to edit a task at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The task is already Completed or Cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/tasks/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  tasksController.getTask,
);
router.patch(
  "/tasks/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  tasksController.updateTask,
);

/**
 * @swagger
 * /tasks/{id}/status:
 *   patch:
 *     summary: Complete or cancel an open task (Staff, Admin)
 *     description: In_progress tasks only (409 otherwise).
 *     tags: [Tasks, Staff]
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
 *               taskStatus: { type: string, enum: [Completed, Cancelled] }
 *     responses:
 *       200:
 *         description: The updated task
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: Missing/invalid taskStatus or id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Staff attempting to act on a task at another shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The task is already Completed or Cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/tasks/:id/status",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  tasksController.updateTaskStatus,
);

module.exports = router;
