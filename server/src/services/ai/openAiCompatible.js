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

// `reason` lets callers tell the fall-back cases apart (not_configured,
// timeout, unreachable, rate_limited, auth_failed, provider_error,
// invalid_response); `code` keeps the standard envelope if one ever reaches
// errorHandler.
const aiError = (message, reason) => {
  const err = new Error(message);
  err.code = "INTERNAL_SERVER_ERROR";
  err.reason = reason;
  return err;
};

const reasonForStatus = (status) => {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth_failed";
  return "provider_error";
};

// Sends one system + user prompt and returns the reply parsed from JSON.
// `schema` is a JSON Schema sent as a strict json_schema response format — in
// strict mode every property must be listed in `required` and every object
// needs `additionalProperties: false`. Groq enforces it at generation time;
// not every provider does, so callers still check the shape they get back.
const generateStructured = async ({
  system,
  user,
  schemaName,
  schema,
  temperature = 0.2,
  reasoningEffort,
  maxTokens,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (!isAiConfigured()) {
    throw aiError(
      "AI is not configured — set AI_BASE_URL, AI_API_KEY and AI_MODEL",
      "not_configured",
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
      throw aiError(`AI request timed out after ${timeoutMs} ms`, "timeout");
    }
    throw aiError(`AI provider unreachable: ${fetchErr.message}`, "unreachable");
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
    throw aiError("AI provider returned no content", "invalid_response");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw aiError("AI provider returned invalid JSON", "invalid_response");
  }
};

module.exports = { isAiConfigured, generateStructured };
