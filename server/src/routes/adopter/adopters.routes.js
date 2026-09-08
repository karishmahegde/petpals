// What it does: Defines the /adopters routes — mounted at /api/v1/adopters in app.js
const express = require("express");
const adoptersController = require("../../controllers/adopter/adopters.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const { singleFile } = require("../../middleware/upload");
const router = express.Router();

/**
 * @swagger
 * /adopters/me:
 *   get:
 *     summary: Get the full profile of the currently logged-in adopter
 *     description: Housing, household, lifestyle, and preference fields. stripeCustomerID is never included.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The adopter profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterProfile' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     summary: Update the profile of the currently logged-in adopter
 *     description: >
 *       Partial update — only the fields present in the body are changed.
 *       adopterEmail, adopterPassword, adopterRiskFlag, preQualifyFlag and
 *       accountStatus are rejected with 400.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AdopterProfileUpdate' }
 *     responses:
 *       200:
 *         description: The updated adopter profile (same shape as GET /adopters/me)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterProfile' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/me", authenticate, authorizeRoles(ROLES.ADOPTER), adoptersController.getMe);
router.put("/me", authenticate, authorizeRoles(ROLES.ADOPTER), adoptersController.updateMe);

/**
 * @swagger
 * /adopters/me/onboarding-step:
 *   patch:
 *     summary: Advance the logged-in adopter's onboarding progress
 *     description: >
 *       Called after a wizard step's own data has been saved. Body `step` is
 *       the step number just completed (2-6). The server sets
 *       onboardingStep = min(max(current, step + 1), 7) — it only ever
 *       advances, regardless of what's sent.
 *     tags: [Adopters]
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
 *               step:
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 7
 *     responses:
 *       200:
 *         description: The updated adopter profile (same shape as GET /adopters/me)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterProfile' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.patch(
  "/me/onboarding-step",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.advanceOnboardingStep,
);

/**
 * @swagger
 * /adopters/me/onboarding-complete:
 *   patch:
 *     summary: Mark the logged-in adopter's onboarding as complete
 *     description: Called on final submit of the onboarding wizard's Review step (Step 7).
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The updated adopter profile (same shape as GET /adopters/me)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterProfile' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.patch(
  "/me/onboarding-complete",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.completeOnboarding,
);

/**
 * @swagger
 * /adopters/me:
 *   delete:
 *     summary: Deactivate or permanently delete the logged-in adopter's account
 *     description: >
 *       Adopter-initiated account closure — distinct from an admin setting
 *       Banned. Blocked with 409 if the adopter has an Accepted
 *       adoption application on record, for either mode. 'deactivate' sets
 *       accountStatus to Deactivated (data retained, no self-service
 *       reactivation). 'delete' permanently removes the adopter's favorites,
 *       visits, adoption applications, government ID, and the Adopter/Users
 *       rows themselves. Both modes clear the refresh token, forcing logout.
 *     tags: [Adopters]
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
 *               mode:
 *                 type: string
 *                 enum: [deactivate, delete]
 *     responses:
 *       200:
 *         description: Account deactivated or deleted (data is null)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: Adopter has an Accepted adoption application on record
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: mode is missing or not one of 'deactivate'/'delete'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete("/me", authenticate, authorizeRoles(ROLES.ADOPTER), adoptersController.closeAccount);

/**
 * @swagger
 * /adopters/me/government-id:
 *   get:
 *     summary: Get the logged-in adopter's submitted government ID
 *     description: Metadata only — idNumber is masked, the document itself is not returned.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The government ID record, including verificationStatus
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/GovernmentIdRecord' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   post:
 *     summary: Submit a government ID document for identity verification
 *     description: >
 *       multipart/form-data upload. The document is stored in a private Supabase
 *       Storage bucket; only metadata is kept in the database, with
 *       verificationStatus defaulting to Pending. One government ID per adopter.
 *       idNumber is masked in the response.
 *     tags: [Adopters]
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
 *               idType:
 *                 type: string
 *                 maxLength: 45
 *                 example: Passport
 *               idNumber:
 *                 type: string
 *                 maxLength: 45
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG, WebP, HEIC, or PDF — max 5 MB
 *     responses:
 *       201:
 *         description: The created government ID record (idNumber masked, verificationStatus = Pending)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/GovernmentIdRecord' }
 *       400:
 *         description: Missing/oversized idType or idNumber, missing file, unsupported file type, or file over 5 MB
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: A government ID already exists for this adopter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/me/government-id",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.getGovernmentId,
);
router.post(
  "/me/government-id",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  singleFile("file"),
  adoptersController.uploadGovernmentId,
);

/**
 * @swagger
 * /adopters/me/applications:
 *   get:
 *     summary: List the logged-in adopter's adoption applications (paginated)
 *     description: >
 *       Returns the adopter's own applications, newest first. Each record
 *       includes the pet name and photo, the shelter name, and applicationStatus.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Accepted, Rejected, Withdrawn]
 *         description: Optional filter by application status
 *       - in: query
 *         name: petID
 *         schema: { type: integer }
 *         description: Optional filter to this adopter's applications for a single pet
 *     responses:
 *       200:
 *         description: Paginated list of the adopter's applications
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AdoptionApplicationListItem' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/me/applications",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.getMyApplications,
);

/**
 * @swagger
 * /adopters/me/visits:
 *   get:
 *     summary: List the logged-in adopter's scheduled visits
 *     description: >
 *       Returns the adopter's visits ordered by visitTime ascending. Each record
 *       includes the shelter name and, when a pet is attached, the pet name.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema: { type: boolean }
 *         description: When exactly "true", returns only visits with visitTime in the future
 *     responses:
 *       200:
 *         description: The adopter's visits, ordered by visitTime ascending (not paginated)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/VisitListItem' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/me/visits",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.getMyVisits,
);

/**
 * @swagger
 * /adopters/me/adopted-pets:
 *   get:
 *     summary: List pets the logged-in adopter has successfully adopted
 *     description: >
 *       Pets whose adoption application by this adopter is Accepted and whose
 *       own adoptionStatus is 'adopted'. Ordered most recently adopted first.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Adopted pets, most recently adopted first (not paginated)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AdoptedPet' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/me/adopted-pets",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.getMyAdoptedPets,
);

/**
 * @swagger
 * /adopters/me/adopted-pets/{petId}/vaccinations:
 *   get:
 *     summary: Vaccination history for a pet the adopter has adopted (read-only)
 *     description: >
 *       Requires an Accepted adoption application by this adopter for the pet —
 *       otherwise 403. Records are ordered by administeredDate descending.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: petId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vaccination records, ordered by administeredDate descending
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/VaccinationRecord' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Role not permitted, or the adopter has no Accepted application for this pet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  "/me/adopted-pets/:petId/vaccinations",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.getMyAdoptedPetVaccinations,
);

module.exports = router;
