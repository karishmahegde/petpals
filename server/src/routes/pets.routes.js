// What it does: Defines the /pets and /species routes — mounted at /api/v1 in app.js
const express = require("express");
const petsController = require("../controllers/pets.controller");
const speciesController = require("../controllers/species.controller");
const breedsController = require("../controllers/breeds.controller");
const router = express.Router();

/**
 * @swagger
 * /pets:
 *   get:
 *     summary: Browse available pets across all shelter branches
 *     tags: [Pets]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: species
 *         schema:
 *           type: array
 *           items: { type: integer, minimum: 1 }
 *         style: form
 *         explode: true
 *         description: Repeatable — e.g. ?species=1&species=2 (OR'd together). Filters by speciesID, matching /breeds' convention.
 *       - in: query
 *         name: breed
 *         schema:
 *           type: array
 *           items: { type: string }
 *         style: form
 *         explode: true
 *         description: Repeatable — e.g. ?breed=Bulldog&breed=Poodle (OR'd together)
 *       - in: query
 *         name: size
 *         schema:
 *           type: array
 *           items: { type: string, enum: [Small, Medium, Large] }
 *         style: form
 *         explode: true
 *         description: Repeatable — e.g. ?size=Small&size=Medium (OR'd together)
 *       - in: query
 *         name: minAge
 *         schema: { type: integer, minimum: 0 }
 *         description: Minimum age in MONTHS (inclusive) — pet must be at least this many months old
 *       - in: query
 *         name: maxAge
 *         schema: { type: integer, minimum: 0 }
 *         description: Maximum age in MONTHS (inclusive) — pet must be at most this many months old
 *       - in: query
 *         name: shelterID
 *         schema:
 *           type: array
 *           items: { type: integer }
 *         style: form
 *         explode: true
 *         description: Repeatable — e.g. ?shelterID=1&shelterID=2 (OR'd together)
 *     responses:
 *       200:
 *         description: Paginated list of pets with adoptionStatus = available. Each pet includes petAge, a formatted string (e.g. "3 yr, 11 mo") computed live from petDOB at request time — not a stored field.
 *       400:
 *         description: Invalid query parameter
 */
router.get("/pets", petsController.getAvailablePets);

/**
 * @swagger
 * /pets/featured:
 *   get:
 *     summary: List featured pets for the Home page's Featured Pets section
 *     tags: [Pets]
 *     responses:
 *       200:
 *         description: Pets with adoptionStatus = available and featuredFlag = true, unpaginated. Each pet includes petAge, a formatted string (e.g. "3 yr, 11 mo") computed live from petDOB at request time — not a stored field.
 */
router.get("/pets/featured", petsController.getFeaturedPets);

/**
 * @swagger
 * /pets/{id}:
 *   get:
 *     summary: View full details for a single pet
 *     tags: [Pets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Pet details, including breed, species, and shelter
 *       400:
 *         description: id is not a positive integer
 *       404:
 *         description: No pet exists with this ID
 */
router.get("/pets/:id", petsController.getPetDetails);

/**
 * @swagger
 * /species:
 *   get:
 *     summary: List all species, for hydrating the species filter dropdown
 *     tags: [Pets]
 *     responses:
 *       200:
 *         description: Species ordered alphabetically by name
 */
router.get("/species", speciesController.getSpecies);

/**
 * @swagger
 * /breeds:
 *   get:
 *     summary: List breeds for the given species, for hydrating the breed filter dropdown
 *     tags: [Pets]
 *     parameters:
 *       - in: query
 *         name: speciesID
 *         schema:
 *           type: array
 *           items: { type: integer, minimum: 1 }
 *         style: form
 *         explode: true
 *         description: Repeatable — e.g. ?speciesID=1&speciesID=2. If omitted, returns empty array
 *     responses:
 *       200:
 *         description: Breeds for the given species, ordered by species name then breed name
 *       400:
 *         description: speciesID is not a positive integer
 */
router.get("/breeds", breedsController.getBreeds);

module.exports = router;
