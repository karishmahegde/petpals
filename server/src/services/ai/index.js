// The ONLY import for AI features — nothing else requires openAiCompatible.js.
// Moving to a provider with a different API means rewriting that one file
// (same pattern as services/geocoding/ and services/storage/).
const provider = require("./openAiCompatible");
const { reserveDailyCall } = require("./dailyCap");

const { AI_ERROR_REASONS, isAiConfigured } = provider;

// Every provider call counts against the app-wide daily cap (dailyCap.js).
// Unconfigured AI isn't counted — the provider file throws not_configured.
const generateStructured = async (options) => {
  if (isAiConfigured()) reserveDailyCall();
  return provider.generateStructured(options);
};

module.exports = { AI_ERROR_REASONS, isAiConfigured, generateStructured };
