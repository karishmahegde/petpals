// The ONLY import for AI features — nothing else requires openAiCompatible.js.
// Moving to a provider with a different API means rewriting that one file
// (same pattern as services/geocoding/ and services/storage/).
const { isAiConfigured, generateStructured } = require("./openAiCompatible");

module.exports = { isAiConfigured, generateStructured };
