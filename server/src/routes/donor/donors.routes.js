// What it does: Defines the Donor self-service /donors/me routes — profile
// and (skippable) onboarding progress, the same shapes as /vets/me and
// /volunteers/me minus the government ID. Mounted at /api/v1 in app.js.
// Plain authenticate throughout: donors are Active from sign-up, so there's
// no Pending state to let through.
const express = require("express");
const donorsController = require("../../controllers/donor/donors.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /donors/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in donor
 *     description: Never includes stripeCustomerID.
 *     tags: [Donors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The donor profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/DonorSelfProfile' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     summary: Update the profile of the currently logged-in donor
 *     description: >
 *       Partial update — only avatarSeed, donorName, donorPhone, donorDOB,
 *       donorSex and the address fields (addressLine1, addressLine2, city,
 *       state, zip, country) may be sent. donorPhone is stored normalised to
 *       E.164. accountStatus and stripeCustomerID are rejected with 400.
 *     tags: [Donors]
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
 *               donorName: { type: string, maxLength: 45 }
 *               donorPhone: { type: string, nullable: true }
 *               donorDOB: { type: string, format: date, nullable: true }
 *               donorSex: { type: string, enum: [M, F, O], nullable: true }
 *               addressLine1: { type: string, maxLength: 100 }
 *               addressLine2: { type: string, maxLength: 100, nullable: true }
 *               city: { type: string, maxLength: 45 }
 *               state: { type: string, maxLength: 45 }
 *               zip: { type: string, maxLength: 10 }
 *               country: { type: string, maxLength: 45 }
 *     responses:
 *       200:
 *         description: The updated donor profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/DonorSelfProfile' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422:
 *         description: donorPhone isn't a valid phone number
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/donors/me",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donorsController.getMyProfile,
);
router.put(
  "/donors/me",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donorsController.updateMyProfile,
);

/**
 * @swagger
 * /donors/me/onboarding-step:
 *   patch:
 *     summary: Advance the logged-in donor's onboarding progress
 *     description: >
 *       Called after a wizard step's own data has been saved (Step 2
 *       Personal, 3 Address, 4 Review — donors submit no government ID).
 *       Body `step` is the step just completed. The server sets
 *       onboardingStep = min(max(current, step + 1), 4) — it only ever
 *       advances. The donor wizard is skippable; donating doesn't wait on it.
 *     tags: [Donors]
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
 *               step: { type: integer, minimum: 2, maximum: 4 }
 *     responses:
 *       200:
 *         description: The updated donor profile (same shape as GET /donors/me)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/DonorSelfProfile' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/donors/me/onboarding-step",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donorsController.advanceOnboardingStep,
);

/**
 * @swagger
 * /donors/me/onboarding-complete:
 *   patch:
 *     summary: Mark the logged-in donor's onboarding as complete
 *     description: >
 *       Final submit of the onboarding wizard's Review step. Requires
 *       donorPhone, donorDOB, donorSex, addressLine1, city, state, zip and
 *       country — 409 lists whatever is missing. Sets
 *       onboardingComplete = true, onboardingStep = 4.
 *     tags: [Donors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The updated donor profile (same shape as GET /donors/me)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/DonorSelfProfile' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.patch(
  "/donors/me/onboarding-complete",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donorsController.completeOnboarding,
);

/**
 * @swagger
 * /donors/me:
 *   delete:
 *     summary: Deactivate or permanently delete your own donor account (Donor only)
 *     description: >
 *       'deactivate' keeps the row (accountStatus → Deactivated, refresh
 *       token cleared); 'delete' permanently removes the Donor and Users
 *       rows. The shelters' records survive either way — every donation
 *       stays, with the donor link set to null on delete (staff see
 *       "Former donor"). Nothing blocks a donor from closing their account.
 *     tags: [Donors]
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
 *       422:
 *         description: mode is missing or not one of 'deactivate'/'delete'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete(
  "/donors/me",
  authenticate,
  authorizeRoles(ROLES.DONOR),
  donorsController.closeMyAccount,
);

module.exports = router;
