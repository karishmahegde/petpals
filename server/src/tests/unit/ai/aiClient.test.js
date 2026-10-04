const { isAiConfigured, generateStructured } = require("../../../services/ai");

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
      reason: "not_configured",
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
    [429, "rate_limited"],
    [401, "auth_failed"],
    [403, "auth_failed"],
    [500, "provider_error"],
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
      reason: "timeout",
    });

    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: "unreachable",
    });
  });

  test("empty or non-JSON content → invalid_response", async () => {
    global.fetch.mockResolvedValueOnce(completion(""));
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: "invalid_response",
    });

    global.fetch.mockResolvedValueOnce(completion("not json"));
    await expect(generateStructured(request)).rejects.toMatchObject({
      reason: "invalid_response",
    });
  });
});
