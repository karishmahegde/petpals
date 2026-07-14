// What it does: Defines the /shelters routes — mounted at /api/v1 in app.js
const express = require("express");
const sheltersController = require("../controllers/shelters.controller");
const router = express.Router();

/**
 * @swagger
 * /shelters/nearby:
 *   get:
 *     summary: List open shelters within a radius of a location, ordered by distance
 *     description: >
 *       Location can be provided either as a lat/lng pair or as a postalCode —
 *       exactly one of these is required. If postalCode is provided, it takes
 *       precedence over lat/lng.
 *     tags: [Shelters]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: false
 *         schema:
 *           type: number
 *         description: Required together with lng if postalCode is not provided
 *       - in: query
 *         name: lng
 *         required: false
 *         schema:
 *           type: number
 *         description: Required together with lat if postalCode is not provided
 *       - in: query
 *         name: postalCode
 *         required: false
 *         schema:
 *           type: string
 *         description: Alternative to lat/lng — postal code to resolve into coordinates
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
 *         description: Missing or invalid lat/lng/radius/postalCode query parameters, or no location found for the given postal code
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
