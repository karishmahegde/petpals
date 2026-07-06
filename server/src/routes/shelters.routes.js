// What it does: Defines the /shelters routes — mounted at /api/v1 in app.js
const express = require("express");
const sheltersController = require("../controllers/shelters.controller");
const router = express.Router();

/**
 * @swagger
 * /shelters/nearby:
 *   get:
 *     summary: List open shelters within a radius of a lat/lng point, ordered by distance
 *     tags: [Shelters]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 25
 *         description: Search radius in kilometers
 *     responses:
 *       200:
 *         description: Open shelters within the radius, ordered by distance ascending
 *       400:
 *         description: Missing or invalid lat/lng/radius query parameters
 */
router.get("/shelters/nearby", sheltersController.getNearbyShelters);

/**
 * @swagger
 * /shelters:
 *   get:
 *     summary: List all open shelters, for hydrating the shelter filter dropdown
 *     tags: [Shelters]
 *     responses:
 *       200:
 *         description: Open shelters ordered alphabetically by name
 */
router.get("/shelters", sheltersController.getShelters);

module.exports = router;
