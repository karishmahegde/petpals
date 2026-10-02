// What it does: Defines the Veterinarian self-service /vets/me routes —
// profile, government ID and onboarding progress, mirroring /staff/me
// (routes/staff/staff.routes.js) so the frontend wizard can reuse the same
// shape. Mounted at /api/v1 in app.js.
const express = require("express");
const vetsController = require("../../controllers/vet/vets.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const { singleFile } = require("../../middleware/upload");
const router = express.Router();

// Every route here except DELETE /vets/me uses authenticate.allowPending: a
// new vet onboards while still Pending, before their shelter manager
// approves them. Keep that set to onboarding needs only — DELETE /vets/me
// and every other vet route use plain authenticate, which rejects Pending
// accounts (same as DELETE /staff/me).

/**
 * @swagger
 * /vets/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in veterinarian
 *     tags: [Vets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The veterinarian profile
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     summary: Update the profile of the currently logged-in veterinarian
 *     description: >
 *       Partial update — only avatarSeed, vetName, vetPhone, vetDOB, vetSex
 *       and the address fields (addressLine1, addressLine2, city, state,
 *       zip, country) may be sent. vetPhone is stored normalised to E.164.
 *       shelterID and accountStatus are rejected with 400 — the shelter is
 *       picked at sign-up and approval is the shelter manager's (PATCH
 *       /staff/me/vets/:id/status). Available to Pending vets.
 *     tags: [Vets]
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
 *               vetName: { type: string, maxLength: 45 }
 *               vetPhone: { type: string, nullable: true }
 *               vetDOB: { type: string, format: date, nullable: true }
 *               vetSex: { type: string, enum: [M, F, O], nullable: true }
 *               addressLine1: { type: string, maxLength: 100 }
 *               addressLine2: { type: string, maxLength: 100, nullable: true }
 *               city: { type: string, maxLength: 45 }
 *               state: { type: string, maxLength: 45 }
 *               zip: { type: string, maxLength: 10 }
 *               country: { type: string, maxLength: 45 }
 *     responses:
 *       200:
 *         description: The updated veterinarian profile
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/vets/me",
  authenticate.allowPending,
  authorizeRoles(ROLES.VETERINARIAN),
  vetsController.getMyProfile,
);
router.put(
  "/vets/me",
  authenticate.allowPending,
  authorizeRoles(ROLES.VETERINARIAN),
  vetsController.updateMyProfile,
);

/**
 * @swagger
 * /vets/me/onboarding-step:
 *   patch:
 *     summary: Advance the logged-in veterinarian's onboarding progress
 *     description: >
 *       Called after a wizard step's own data has been saved (Step 2
 *       Personal, 3 Address, 4 Identity, 5 Review). Body `step` is the step
 *       just completed. The server sets onboardingStep = min(max(current,
 *       step + 1), 5) — it only ever advances. Available to Pending vets:
 *       onboarding happens before approval.
 *     tags: [Vets]
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
 *         description: The updated veterinarian profile (same shape as GET /vets/me)
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/vets/me/onboarding-step",
  authenticate.allowPending,
  authorizeRoles(ROLES.VETERINARIAN),
  vetsController.advanceOnboardingStep,
);

/**
 * @swagger
 * /vets/me/onboarding-complete:
 *   patch:
 *     summary: Mark the logged-in veterinarian's onboarding as complete
 *     description: >
 *       Final submit of the onboarding wizard's Review step. Requires
 *       vetPhone, vetDOB, vetSex, addressLine1, city, state, zip, country
 *       and a submitted government ID — 409 lists whatever is missing. Sets
 *       onboardingComplete = true, onboardingStep = 5. A Pending vet then
 *       waits for their shelter manager's approval.
 *     tags: [Vets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The updated veterinarian profile (same shape as GET /vets/me)
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.patch(
  "/vets/me/onboarding-complete",
  authenticate.allowPending,
  authorizeRoles(ROLES.VETERINARIAN),
  vetsController.completeOnboarding,
);

/**
 * @swagger
 * /vets/me/government-id:
 *   get:
 *     summary: Get the logged-in veterinarian's submitted government ID (Veterinarian only)
 *     description: >
 *       idNumber is masked (e.g. *****4567) on this response, same as the
 *       POST response — never returned in full on either route.
 *     tags: [Vets]
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
 *     summary: Submit a government ID for identity verification (Veterinarian only)
 *     description: >
 *       One per veterinarian (`@@unique([userID, userType])`) — a second
 *       submission is rejected with 409, except a Rejected record, which can
 *       be resubmitted (overwrites the row, resets it to Pending). Stored in
 *       the private government-ids bucket.
 *     tags: [Vets]
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
 *         description: A government ID already exists for this veterinarian
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/vets/me/government-id",
  authenticate.allowPending,
  authorizeRoles(ROLES.VETERINARIAN),
  vetsController.getGovernmentId,
);
router.post(
  "/vets/me/government-id",
  authenticate.allowPending,
  authorizeRoles(ROLES.VETERINARIAN),
  singleFile("file"),
  vetsController.uploadGovernmentId,
);

/**
 * @swagger
 * /vets/me:
 *   delete:
 *     summary: Deactivate or permanently delete your own veterinarian account (Veterinarian only)
 *     description: >
 *       'deactivate' keeps the row (accountStatus → Deactivated, refresh
 *       token cleared); 'delete' permanently removes the Veterinarian and
 *       Users rows and the government ID with its stored file. The pets'
 *       history survives a delete — health records, vaccinations and
 *       appointments keep existing with the vet link set to null. Either
 *       mode is blocked with 409 while the vet has upcoming Scheduled
 *       appointments; staff must reassign them first.
 *     tags: [Vets]
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
 *         description: The vet still has upcoming Scheduled appointments
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
  "/vets/me",
  authenticate,
  authorizeRoles(ROLES.VETERINARIAN),
  vetsController.closeMyAccount,
);

module.exports = router;
