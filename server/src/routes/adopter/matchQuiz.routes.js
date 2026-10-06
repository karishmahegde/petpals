// Compatibility-matcher quiz endpoints — mounted at /api/v1 in app.js so this
// router owns both URL shapes: /match-quiz/questions and /adopters/me/quiz.
const express = require("express");
const controller = require("../../controllers/adopter/matchQuiz.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /match-quiz/questions:
 *   get:
 *     summary: Get the personality quiz questions and their options
 *     description: >
 *       Served as-is from the server config (config/matchQuiz.js). Each
 *       question's options are ordered from most to least on the trait it
 *       measures; answers are saved by option `code`.
 *     tags: [Match Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The quiz questions, in display order
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/MatchQuizQuestion' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  "/match-quiz/questions",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.getQuestions,
);

/**
 * @swagger
 * /adopters/me/quiz:
 *   get:
 *     summary: Get the logged-in adopter's saved quiz answers
 *     description: >
 *       data is null if the adopter hasn't taken the quiz. Answers whose
 *       question or option no longer exists in the config are left out.
 *     tags: [Match Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The saved answers, or null
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterQuiz' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     summary: Save (or retake) the logged-in adopter's quiz answers
 *     description: >
 *       The whole answer set — every question must be answered. Unknown
 *       questions or options, and missing questions, are 400. Saving clears
 *       the adopter's cached matches so they're recomputed.
 *     tags: [Match Quiz]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers: { $ref: '#/components/schemas/QuizAnswers' }
 *     responses:
 *       200:
 *         description: The saved answers
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AdopterQuiz' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get("/adopters/me/quiz", authenticate, authorizeRoles(ROLES.ADOPTER), controller.getMyQuiz);
router.put("/adopters/me/quiz", authenticate, authorizeRoles(ROLES.ADOPTER), controller.saveMyQuiz);

module.exports = router;
