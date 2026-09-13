// What it does: Defines the Admin-only shelter management routes — mounted at
// /api/v1 in app.js, alongside (not instead of) the public read-only
// /shelters routes in routes/public/shelters.routes.js.
const express = require("express");
const sheltersController = require("../../controllers/admin/shelters.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /shelters:
 *   post:
 *     summary: Create a new shelter (Admin only)
 *     description: >
 *       The only supported way to add a shelter to the network (NF-04) — there
 *       is no other creation path. shelterZIP is geocoded into shelterLocation
 *       (used by /shelters/nearby); shelterStatus always starts as 'Open'.
 *     tags: [Shelters, Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ShelterCreate' }
 *     responses:
 *       201:
 *         description: The created shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Shelter' }
 *       400:
 *         description: Missing/invalid field, or shelterZIP could not be geocoded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post(
  "/shelters",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  sheltersController.createShelter,
);

/**
 * @swagger
 * /shelters/{id}:
 *   put:
 *     summary: Update a shelter's details (Admin only)
 *     description: >
 *       Partial update — only fields present in the body are changed.
 *       shelterLocation is re-geocoded only when shelterAddress or shelterZIP
 *       is included in the body.
 *     tags: [Shelters, Admin]
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
 *           schema: { $ref: '#/components/schemas/ShelterUpdate' }
 *     responses:
 *       200:
 *         description: The updated shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Shelter' }
 *       400:
 *         description: No updatable fields provided, invalid field, or shelterZIP could not be geocoded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  "/shelters/:id",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  sheltersController.updateShelter,
);

/**
 * @swagger
 * /shelters/{id}/status:
 *   patch:
 *     summary: Change a shelter's status (Admin only)
 *     tags: [Shelters, Admin]
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
 *             required: [shelterStatus]
 *             properties:
 *               shelterStatus:
 *                 type: string
 *                 enum: [Open, Full, Closed]
 *     responses:
 *       200:
 *         description: The updated shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Shelter' }
 *       400:
 *         description: shelterStatus missing or not one of Open/Full/Closed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/shelters/:id/status",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  sheltersController.updateShelterStatus,
);

/**
 * @swagger
 * /shelters/{id}/manager:
 *   patch:
 *     summary: (Re)assign the staff member who manages a shelter (Admin only)
 *     description: >
 *       managerStaffID must belong to a Staff record at this shelter — a staff
 *       member who exists but works at a different shelter is treated as not
 *       found (404), same as a nonexistent staff ID.
 *     tags: [Shelters, Admin]
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
 *             required: [managerStaffID]
 *             properties:
 *               managerStaffID: { type: integer }
 *     responses:
 *       200:
 *         description: The updated shelter
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Shelter' }
 *       400:
 *         description: managerStaffID missing or not a positive integer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: The shelter does not exist, or managerStaffID does not belong to a staff member at this shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: The staff member is Deactivated and cannot be assigned as manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/shelters/:id/manager",
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  sheltersController.updateShelterManager,
);

module.exports = router;
