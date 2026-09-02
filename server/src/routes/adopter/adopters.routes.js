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
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Adopter profile, including housing, household, lifestyle, and preference fields. Sensitive fields (stripeCustomerID) are never included.
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: No adopter record exists for the current user
 *   put:
 *     summary: Update the profile of the currently logged-in adopter
 *     description: >
 *       Partial update — only the fields present in the request body are changed.
 *       Password and email changes are out of scope. Admin-only fields
 *       (adopterRiskFlag, preQualifyFlag, accountStatus) are rejected.
 *     tags: [Adopters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The updated adopter profile, in the same shape as GET /adopters/me.
 *       400:
 *         description: Invalid enum value, malformed field, or an attempt to update an admin-only field
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: No adopter record exists for the current user
 */
router.get("/me", authenticate, authorizeRoles(ROLES.ADOPTER), adoptersController.getMe);
router.put("/me", authenticate, authorizeRoles(ROLES.ADOPTER), adoptersController.updateMe);

/**
 * @swagger
 * /adopters/me/government-id:
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
 *         description: The created GOVERNMENT_ID record (idNumber masked)
 *       400:
 *         description: Missing/oversized idType or idNumber, missing file, unsupported file type, or file over 5 MB
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       409:
 *         description: A government ID already exists for this adopter
 */
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
 *     responses:
 *       200:
 *         description: Paginated list of applications (data + pagination object)
 *       400:
 *         description: Invalid page, limit, or status value
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 */
router.get(
  "/me/applications",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  adoptersController.getMyApplications,
);

module.exports = router;
