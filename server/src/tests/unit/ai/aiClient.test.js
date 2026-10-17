const {
  AI_ERROR_REASONS,
  isAiConfigured,
  generateStructured,
} = require("../../../services/ai");

const SCHEMA = {
  type: "object",
  properties: { score: { type: "integer" } },
  required: ["score"],
  additionalProperties: false,
};
const request = { system: "sys", user: "usr", schemaName: "fit", schema: SCHEMA };

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const completion = (content) =>
  jsonResponse(200, { choices: [{ message: { content } }] });

const savedEnv = {};
const AI_VARS = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"];

beforeEach(() => {
  AI_VARS.forEach((name) => {
    savedEnv[name] = process.env[name];
  });
  process.env.AI_BASE_URL = "https://ai.example.test/v1/";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
  global.fetch = jest.fn();
});

afterEach(() => {
  AI_VARS.forEach((name) => {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  });
  delete global.fetch;
});

describe("AI_ERROR_REASONS", () => {
  // The values are what callers see on err.reason — pinned so a rename is a
  // deliberate, visible change.
  test("lists every reason with its stable value, and can't be changed", () => {
    expect(AI_ERROR_REASONS).toEqual({
      NOT_CONFIGURED: "not_configured",
      TIMEOUT: "timeout",
      UNREACHABLE: "unreachable",
      RATE_LIMITED: "rate_limited",
      AUTH_FAILED: "auth_failed",
      PROVIDER_ERROR: "provider_error",
      INVALID_RESPONSE: "invalid_response",
    });
    expect(Object.isFrozen(AI_ERROR_REASONS)).toBe(true);
  });
});

describe("isAiConfigured", () => {
  test("true only when base URL, key and model are all set", () => {
    expect(isAiConfigured()).toBe(true);
    for (const name of AI_VARS) {
      const value = process.env[name];
      process.env[name] = "  ";
      expect(isAiConfigured()).toBe(false);
      process.env[name] = value;
    }
  });
});

describe("generateStructured", () => {
  test("not configured → rejects without calling the provider", async () => {
    process.env.AI_API_KEY = "";
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: AI_ERROR_REASONS.NOT_CONFIGURED,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("posts a strict json_schema request and returns the parsed reply", async () => {
    global.fetch.mockResolvedValue(completion('{"score":7}'));

    await expect(
      generateStructured({ ...request, reasoningEffort: "low", maxTokens: 500 }),
    ).resolves.toEqual({ score: 7 });

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://ai.example.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "test-model",
      temperature: 0.2,
      reasoning_effort: "low",
      max_completion_tokens: 500,
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "usr" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "fit", strict: true, schema: SCHEMA },
      },
    });
  });

  test("optional reasoning effort and token cap are omitted unless given", async () => {
    global.fetch.mockResolvedValue(completion('{"score":1}'));
    await generateStructured(request);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("max_completion_tokens");
  });

  test.each([
    [429, AI_ERROR_REASONS.RATE_LIMITED],
    [401, AI_ERROR_REASONS.AUTH_FAILED],
    [403, AI_ERROR_REASONS.AUTH_FAILED],
    [500, AI_ERROR_REASONS.PROVIDER_ERROR],
  ])("HTTP %i → reason %s, with the provider's message", async (status, reason) => {
    global.fetch.mockResolvedValue(
      jsonResponse(status, { error: { message: "nope" } }),
    );
    await expect(generateStructured(request)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      reason,
      message: `AI provider returned ${status}: nope`,
    });
  });

  test("timeout and network failures are told apart", async () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    global.fetch.mockRejectedValueOnce(timeout);
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: AI_ERROR_REASONS.TIMEOUT,
    });

    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: AI_ERROR_REASONS.UNREACHABLE,
    });
  });

  test("empty or non-JSON content → invalid_response", async () => {
    global.fetch.mockResolvedValueOnce(completion(""));
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: AI_ERROR_REASONS.INVALID_RESPONSE,
    });

    global.fetch.mockResolvedValueOnce(completion("not json"));
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: AI_ERROR_REASONS.INVALID_RESPONSE,
    });
  });
});
