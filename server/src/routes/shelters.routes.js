// What it does: Defines the /shelters routes — mounted at /api/v1 in app.js
const express = require("express");
const sheltersController = require("../controllers/shelters.controller");

const router = express.Router();

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
