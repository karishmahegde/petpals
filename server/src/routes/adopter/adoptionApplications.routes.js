// Defines the /adoption-applications routes — mounted at /api/v1/adoption-applications in app.js
const express = require("express");
const controller = require("../../controllers/adopter/adoptionApplications.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /adoption-applications:
 *   post:
 *     summary: Start payment for an adoption application (creates a Stripe Checkout Session)
 *     description: >
 *       Validates the pet/shelter/application eligibility (pet exists, is
 *       'available', shelterID matches, no existing active application for
 *       this adopter+pet), ensures the adopter has a Stripe Customer, then
 *       creates a $15 Stripe Checkout Session and returns its URL. The
 *       AdoptionApplication row itself is NOT created by this endpoint — it
 *       is only ever created by the Stripe webhook once payment is
 *       confirmed (POST /webhooks/stripe), with the form data carried
 *       through via the session's metadata.
 *     tags: [Adoption Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petID, shelterID, applicationType]
 *             properties:
 *               petID:
 *                 type: integer
 *               shelterID:
 *                 type: integer
 *                 description: Must match the pet's shelter
 *               applicationType:
 *                 type: string
 *                 enum: [Adopt, Foster]
 *               shelterMessage:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *     responses:
 *       201:
 *         description: The Stripe Checkout Session URL to redirect the browser to
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
 *                         checkoutUrl: { type: string }
 *       400:
 *         description: Missing/invalid petID or shelterID, or shelterID does not match the pet's shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Pet is not available, or the adopter already has an active application for it
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.createApplication,
);

/**
 * @swagger
 * /adoption-applications:
 *   get:
 *     summary: >
 *       Look up an adopter's application by Stripe Checkout Session ID
 *       (Adopter), OR list the shelter's application queue (Staff, Admin)
 *     description: >
 *       One path, two purposes, distinguished by whether checkoutSessionId
 *       is present in the query — matches the original API design.
 *
 *       With checkoutSessionId (Adopter only): used by the post-payment
 *       confirmation page to poll for the AdoptionApplication row the
 *       webhook creates. Returns data: null (not a 404) while the webhook
 *       hasn't landed yet — that's the expected common answer for a poll,
 *       not an error.
 *
 *       Without it (Staff, Admin only): a paginated, filterable queue, split
 *       into two sections by ?section= — "active" (Pending, needs a
 *       decision) or "past" (Accepted/Rejected/Withdrawn, already
 *       resolved), mirroring the Transfers/Appointments tabs' own
 *       Active/Past split. Staff sees only their own shelter's applications
 *       (shelterID re-fetched fresh from the STAFF table, never the JWT,
 *       never a query param); Admin sees all, optionally filtered by
 *       ?shelterID=.
 *     tags: [Adoption Applications, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: checkoutSessionId
 *         schema: { type: string }
 *         description: Adopter-only branch. Required to trigger it.
 *       - in: query
 *         name: section
 *         schema: { type: string, enum: [active, past] }
 *         description: Staff/Admin branch only. Required for that branch.
 *       - in: query
 *         name: species
 *         schema: { type: array, items: { type: integer } }
 *         description: Staff/Admin branch only. Repeatable speciesID filter.
 *       - in: query
 *         name: adopterName
 *         schema: { type: string }
 *         description: Staff/Admin branch only. Contains match on the adopter's name.
 *       - in: query
 *         name: petName
 *         schema: { type: string }
 *         description: Staff/Admin branch only. Contains match on the pet's name.
 *       - in: query
 *         name: shelterID
 *         schema: { type: integer }
 *         description: Admin branch only — Staff is always scoped to their own shelter.
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Staff/Admin branch only.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Staff/Admin branch only.
 *     responses:
 *       200:
 *         description: >
 *           Either the single application record (or null) for the
 *           checkoutSessionId branch, or a paginated list for the
 *           Staff/Admin branch
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Adopter without checkoutSessionId, or Staff/Admin with it
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(ROLES.ADOPTER, ROLES.STAFF, ROLES.ADMIN),
  controller.getApplications,
);

/**
 * @swagger
 * /adoption-applications/{id}:
 *   get:
 *     summary: Get a single adoption application by ID
 *     description: >
 *       Adopters may only retrieve their own applications; staff may retrieve
 *       any. Includes the pet summary, assigned staff name, and the shelter's
 *       closing remark — for the Applications section's detail slide-over.
 *     tags: [Adoption Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The full application record
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdoptionApplicationFullDetail' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Role not permitted, or an adopter requesting another adopter's application
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/:id",
  authenticate,
  authorizeRoles(ROLES.ADOPTER, ROLES.STAFF),
  controller.getApplication,
);

/**
 * @swagger
 * /adoption-applications/{id}/status:
 *   patch:
 *     summary: Withdraw (Adopter) or Accept/Reject (Staff, Admin) an adoption application
 *     description: >
 *       Which transitions are valid depends on the caller's role, not a
 *       shared enum: Adopter may move their own application to 'Withdrawn'
 *       from 'Pending' or 'Accepted' (the $15 processing fee is not
 *       refunded); withdrawing an Accepted application also sets the pet
 *       back to 'available'. Staff/Admin may move a 'Pending' application to
 *       'Accepted' or 'Rejected' — Staff only at their own shelter (403
 *       otherwise); Admin any shelter. Accepting sets staffID to the acting
 *       Staff member (never set for an Admin actor — the column FKs
 *       Staff.userID, which an Admin doesn't have) and sets the pet's
 *       adoptionStatus to 'adopted'; Rejecting leaves the pet's
 *       adoptionStatus untouched, still available for other applicants.
 *       Moving to 'Withdrawn' or 'Rejected' clears the active
 *       (adopterID, petID) uniqueness constraint, so the adopter can
 *       re-apply for the same pet afterwards.
 *     tags: [Adoption Applications, Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 description: Withdrawn (Adopter) or Accepted/Rejected (Staff, Admin)
 *                 enum: [Withdrawn, Accepted, Rejected]
 *               staffRemark:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 description: Staff/Admin only — ignored for an Adopter caller
 *     responses:
 *       200:
 *         description: The updated application, with nested pet.petName and shelter.shelterName
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdoptionApplicationDetail' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Role not permitted, an adopter acting on another adopter's application, or Staff acting on another shelter's application
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The application isn't in a status the requested transition allows
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles(ROLES.ADOPTER, ROLES.STAFF, ROLES.ADMIN),
  controller.updateApplicationStatus,
);

/**
 * @swagger
 * /adoption-applications/{id}:
 *   patch:
 *     summary: Assign an application's staff (shelter Manager, Admin)
 *     description: >
 *       staffID is the only editable field. Only the application's shelter
 *       manager (Shelter.managerStaffID) or an Admin may set it, only while
 *       the application is Pending, and only to an Active staff member at
 *       that shelter.
 *     tags: [Adoption Applications, Staff]
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
 *             required: [staffID]
 *             properties:
 *               staffID: { type: integer }
 *     responses:
 *       200:
 *         description: The updated application
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdoptionApplicationFullDetail' }
 *       400:
 *         description: Invalid id/staffID, or the staff member isn't active at the application's shelter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Caller isn't the application's shelter manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: The application is no longer Pending
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  "/:id",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  controller.updateApplication,
);

module.exports = router;
