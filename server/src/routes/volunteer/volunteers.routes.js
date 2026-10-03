// What it does: Defines the Volunteer self-service /volunteers/me routes —
// profile, availability, government ID and onboarding progress, mirroring
// /vets/me (routes/vet/vets.routes.js) so the frontend wizard can reuse the
// same shape. Mounted at /api/v1 in app.js, BEFORE the staff volunteers
// router — otherwise /volunteers/me would be caught by the staff
// GET /volunteers/:id (Staff/Admin only) and answer a volunteer with 403.
const express = require("express");
const volunteersController = require("../../controllers/volunteer/volunteers.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const { singleFile } = require("../../middleware/upload");
const router = express.Router();

// Profile, government ID and onboarding use authenticate.allowPending: a new
// volunteer onboards while still Pending, before staff at their shelter
// approve them. Keep that set to onboarding needs only — availability,
// DELETE /volunteers/me and every other volunteer route use plain
// authenticate, which rejects Pending accounts (401), same as
// DELETE /vets/me.

/**
 * @swagger
 * /volunteers/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in volunteer
 *     description: >
 *       Includes volunteerCode, the weekly availability (`availability`,
 *       decoded from volunteerSchedule — null if volunteerSchedule is older
 *       free text) and the shelter's contact details. Available to Pending
 *       volunteers.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The volunteer profile
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     summary: Update the profile of the currently logged-in volunteer
 *     description: >
 *       Partial update — only avatarSeed, volunteerName, volunteerPhone,
 *       volunteerDOB, volunteerSex and the address fields (addressLine1,
 *       addressLine2, city, state, zip, country) may be sent.
 *       volunteerPhone is stored normalised to E.164. shelterID and
 *       accountStatus are rejected with 400 — the shelter is picked at
 *       sign-up and approval is the shelter staff's (PATCH
 *       /volunteers/:id/status). Available to Pending volunteers.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avatarSeed: { type: string, maxLength: 64 }
 *               volunteerName: { type: string, maxLength: 45 }
 *               volunteerPhone: { type: string, nullable: true }
 *               volunteerDOB: { type: string, format: date, nullable: true }
 *               volunteerSex: { type: string, enum: [M, F, O], nullable: true }
 *               addressLine1: { type: string, maxLength: 100 }
 *               addressLine2: { type: string, maxLength: 100, nullable: true }
 *               city: { type: string, maxLength: 45 }
 *               state: { type: string, maxLength: 45 }
 *               zip: { type: string, maxLength: 10 }
 *               country: { type: string, maxLength: 45 }
 *     responses:
 *       200:
 *         description: The updated volunteer profile
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422:
 *         description: volunteerPhone isn't a valid phone number
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/volunteers/me",
  authenticate.allowPending,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.getMyProfile,
);
router.put(
  "/volunteers/me",
  authenticate.allowPending,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.updateMyProfile,
);

/**
 * @swagger
 * /volunteers/me/availability:
 *   put:
 *     summary: Replace the logged-in volunteer's weekly availability (Volunteer only)
 *     description: >
 *       The whole week, as days (Mon–Sun) mapped to slots (Morning,
 *       Afternoon, Evening); days left out are unavailable and `{}` clears
 *       it. Unknown days or slots are 400. Stored compactly in
 *       volunteerSchedule (e.g. "Mon:MA;Wed:E") and returned decoded as
 *       `availability` on GET /volunteers/me and the staff GET
 *       /volunteers/{id}. Not available to Pending volunteers.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availability]
 *             properties:
 *               availability:
 *                 type: object
 *                 additionalProperties:
 *                   type: array
 *                   items: { type: string, enum: [Morning, Afternoon, Evening] }
 *                 example: { Mon: [Morning, Afternoon], Wed: [Evening] }
 *     responses:
 *       200:
 *         description: The updated volunteer profile (same shape as GET /volunteers/me)
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  "/volunteers/me/availability",
  authenticate,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.updateMyAvailability,
);

/**
 * @swagger
 * /volunteers/me/onboarding-step:
 *   patch:
 *     summary: Advance the logged-in volunteer's onboarding progress
 *     description: >
 *       Called after a wizard step's own data has been saved (Step 2
 *       Personal, 3 Address, 4 Identity, 5 Review). Body `step` is the step
 *       just completed. The server sets onboardingStep = min(max(current,
 *       step + 1), 5) — it only ever advances. Available to Pending
 *       volunteers: onboarding happens before approval.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [step]
 *             properties:
 *               step: { type: integer, minimum: 2, maximum: 5 }
 *     responses:
 *       200:
 *         description: The updated volunteer profile (same shape as GET /volunteers/me)
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/volunteers/me/onboarding-step",
  authenticate.allowPending,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.advanceOnboardingStep,
);

/**
 * @swagger
 * /volunteers/me/onboarding-complete:
 *   patch:
 *     summary: Mark the logged-in volunteer's onboarding as complete
 *     description: >
 *       Final submit of the onboarding wizard's Review step. Requires
 *       volunteerPhone, volunteerDOB, volunteerSex, addressLine1, city,
 *       state, zip, country and a submitted government ID — 409 lists
 *       whatever is missing. Sets onboardingComplete = true,
 *       onboardingStep = 5. A Pending volunteer then waits for staff at
 *       their shelter to approve them.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The updated volunteer profile (same shape as GET /volunteers/me)
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.patch(
  "/volunteers/me/onboarding-complete",
  authenticate.allowPending,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.completeOnboarding,
);

/**
 * @swagger
 * /volunteers/me/government-id:
 *   get:
 *     summary: Get the logged-in volunteer's submitted government ID (Volunteer only)
 *     description: >
 *       idNumber is masked (e.g. *****4567) on this response, same as the
 *       POST response — never returned in full on either route.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The government ID record
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: No government ID has been submitted yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   post:
 *     summary: Submit a government ID for identity verification (Volunteer only)
 *     description: >
 *       One per volunteer (`@@unique([userID, userType])`) — a second
 *       submission is rejected with 409, except a Rejected record, which can
 *       be resubmitted (overwrites the row, resets it to Pending). Stored in
 *       the private government-ids bucket.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [idType, idNumber, file]
 *             properties:
 *               idType: { type: string, maxLength: 45 }
 *               idNumber: { type: string, maxLength: 45 }
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: The created/resubmitted government ID record
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: A government ID already exists for this volunteer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/volunteers/me/government-id",
  authenticate.allowPending,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.getGovernmentId,
);
router.post(
  "/volunteers/me/government-id",
  authenticate.allowPending,
  authorizeRoles(ROLES.VOLUNTEER),
  singleFile("file"),
  volunteersController.uploadGovernmentId,
);

/**
 * @swagger
 * /volunteers/me:
 *   delete:
 *     summary: Deactivate or permanently delete your own volunteer account (Volunteer only)
 *     description: >
 *       'deactivate' keeps the row (accountStatus → Deactivated, refresh
 *       token cleared); 'delete' permanently removes the Volunteer and Users
 *       rows and the government ID with its stored file. Either way the
 *       volunteer comes off events that haven't happened yet. A delete also
 *       removes their past task and event assignments (the tasks and events
 *       stay), while appointments they assisted keep existing with the
 *       volunteer link set to null. Either mode is blocked with 409 while
 *       the volunteer is assisting an upcoming Scheduled appointment or has
 *       an In_progress task; staff must reassign them first. Not available
 *       to Pending volunteers.
 *     tags: [Volunteers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mode]
 *             properties:
 *               mode: { type: string, enum: [deactivate, delete] }
 *     responses:
 *       200:
 *         description: Account deactivated or deleted
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: The volunteer still has upcoming appointments or open tasks
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: mode is missing or not one of 'deactivate'/'delete'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete(
  "/volunteers/me",
  authenticate,
  authorizeRoles(ROLES.VOLUNTEER),
  volunteersController.closeMyAccount,
);

module.exports = router;
