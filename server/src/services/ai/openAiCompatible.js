// The ONLY file that talks to the AI provider. It speaks the OpenAI
// chat-completions format, which Groq, Ollama and OpenRouter all accept, so
// switching provider is a change to AI_BASE_URL / AI_API_KEY / AI_MODEL in
// server/.env, not to code. Uses global fetch (like services/storage/) so no
// SDK dependency is needed.

const DEFAULT_TIMEOUT_MS = 30000;

// Read on every call rather than at require time, so tests can switch AI on
// and off by setting process.env.
const readConfig = () => ({
  baseUrl: (process.env.AI_BASE_URL || "").trim().replace(/\/+$/, ""),
  apiKey: (process.env.AI_API_KEY || "").trim(),
  model: (process.env.AI_MODEL || "").trim(),
});

// AI is optional — with any of the three unset, features fall back instead of
// calling out. Ollama ignores the key, but it still has to be non-empty here.
const isAiConfigured = () => {
  const { baseUrl, apiKey, model } = readConfig();
  return Boolean(baseUrl && apiKey && model);
};

// Every value an AI error's `reason` can take — compare against these, never
// a string literal, so a typo fails loudly (undefined) instead of silently
// never matching.
const AI_ERROR_REASONS = Object.freeze({
  NOT_CONFIGURED: "not_configured", // AI_* env vars not all set
  TIMEOUT: "timeout", // no reply within timeoutMs
  UNREACHABLE: "unreachable", // network failure before any reply
  RATE_LIMITED: "rate_limited", // HTTP 429
  AUTH_FAILED: "auth_failed", // HTTP 401/403 — bad or revoked key
  PROVIDER_ERROR: "provider_error", // any other non-OK status
  INVALID_RESPONSE: "invalid_response", // empty reply, or not valid JSON
});

// `reason` (one of AI_ERROR_REASONS) lets callers tell the fall-back cases
// apart; `code` keeps the standard envelope if one ever reaches errorHandler.
const aiError = (message, reason) => {
  const err = new Error(message);
  err.code = "INTERNAL_SERVER_ERROR";
  err.reason = reason;
  return err;
};

const reasonForStatus = (status) => {
  if (status === 429) return AI_ERROR_REASONS.RATE_LIMITED;
  if (status === 401 || status === 403) return AI_ERROR_REASONS.AUTH_FAILED;
  return AI_ERROR_REASONS.PROVIDER_ERROR;
};

// Sends one system + user prompt and returns the reply parsed from JSON.
// `schema` is a JSON Schema sent as a strict json_schema response format — in
// strict mode every property must be listed in `required` and every object
// needs `additionalProperties: false`. Groq enforces it at generation time;
// not every provider does, so callers still check the shape they get back.
const generateStructured = async ({
  // Standing instructions — the model's role and rules, the same on every call
  // for a feature. Kept apart from `user` so data can't override the rules.
  system,
  // This call's data (e.g. quiz answers + shortlisted pets), usually
  // JSON.stringify'd. Treated as input to judge, not instructions.
  user,
  // Short label for the output shape (letters, digits, _ or -), e.g. "pet_fit".
  // Only names the schema; doesn't change the reply.
  schemaName,
  // JSON Schema the reply must match; the parsed object is what's returned.
  schema,
  // Low = consistent answers (the same pet scores about the same each run).
  temperature = 0.2,
  // "low" | "medium" | "high", or omitted for the provider's default — how
  // long a reasoning model thinks before answering.
  reasoningEffort,
  // Caps the reply length (sent as max_completion_tokens); omitted = no cap.
  maxTokens,
  // Gives up after this, with AI_ERROR_REASONS.TIMEOUT.
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (!isAiConfigured()) {
    throw aiError(
      "AI is not configured — set AI_BASE_URL, AI_API_KEY and AI_MODEL",
      AI_ERROR_REASONS.NOT_CONFIGURED,
    );
  }
  const { baseUrl, apiKey, model } = readConfig();

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema },
    },
  };
  // Reasoning models (gpt-oss) think before answering, and those tokens count
  // toward the free-tier limits — "low" keeps short scoring calls cheap.
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;
  if (maxTokens) body.max_completion_tokens = maxTokens;

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (fetchErr) {
    if (fetchErr.name === "TimeoutError") {
      throw aiError(`AI request timed out after ${timeoutMs} ms`, AI_ERROR_REASONS.TIMEOUT);
    }
    throw aiError(`AI provider unreachable: ${fetchErr.message}`, AI_ERROR_REASONS.UNREACHABLE);
  }

  if (!res.ok) {
    // Keep only the provider's own message — never the request we sent.
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch {
      // non-JSON error body
    }
    throw aiError(
      `AI provider returned ${res.status}${detail ? `: ${detail}` : ""}`,
      reasonForStatus(res.status),
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw aiError("AI provider returned no content", AI_ERROR_REASONS.INVALID_RESPONSE);
  }
  try {
    return JSON.parse(content);
  } catch {
    throw aiError("AI provider returned invalid JSON", AI_ERROR_REASONS.INVALID_RESPONSE);
  }
};

module.exports = { AI_ERROR_REASONS, isAiConfigured, generateStructured };
