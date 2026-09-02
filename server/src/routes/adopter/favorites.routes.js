// Favorites endpoints — mounted at /api/v1 in app.js so this router owns both
// URL shapes: /pets/:id/favorites and /adopters/me/favorites.
const express = require("express");
const controller = require("../../controllers/adopter/favorites.controller");
const authenticate = require("../../middleware/authenticate");
const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");
const router = express.Router();

/**
 * @swagger
 * /pets/{id}/favorites:
 *   post:
 *     summary: Add a pet to the logged-in adopter's favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: The created favorite (adopterID + petID)
 *       400:
 *         description: id is not a positive integer
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: No pet exists with the given ID
 *       409:
 *         description: Pet is already in the adopter's favorites
 *   delete:
 *     summary: Remove a pet from the logged-in adopter's favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pet removed from favorites
 *       400:
 *         description: id is not a positive integer
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 *       404:
 *         description: Pet was not in the adopter's favorites
 */
router.post(
  "/pets/:id/favorites",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.addFavorite,
);
router.delete(
  "/pets/:id/favorites",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.removeFavorite,
);

/**
 * @swagger
 * /adopters/me/favorites:
 *   get:
 *     summary: List the logged-in adopter's favorited pets (paginated)
 *     description: Each entry is the full pet-detail shape (same as GET /pets/:id).
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of favorited pets (data + pagination)
 *       400:
 *         description: Invalid page or limit
 *       401:
 *         description: No token or token invalid/expired
 *       403:
 *         description: Valid token but role is not Adopter
 */
router.get(
  "/adopters/me/favorites",
  authenticate,
  authorizeRoles(ROLES.ADOPTER),
  controller.listFavorites,
);

module.exports = router;
