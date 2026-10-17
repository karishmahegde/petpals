// The ONLY import for AI features — nothing else requires openAiCompatible.js.
// Moving to a provider with a different API means rewriting that one file
// (same pattern as services/geocoding/ and services/storage/).
const { AI_ERROR_REASONS, isAiConfigured, generateStructured } = require("./openAiCompatible");

module.exports = { AI_ERROR_REASONS, isAiConfigured, generateStructured };
