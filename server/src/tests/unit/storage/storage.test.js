// The Supabase Storage layer (services/storage/index.js): each call's request
// to the Storage REST API, how a failure surfaces, and the config checks.
// global.fetch is faked — nothing reaches Supabase. The module reads its two
// settings when loaded, so each test sets the environment and loads a fresh copy.
const SUPABASE_URL = "https://project.supabase.co";
const KEY = "service-role-key";

const loadStorage = (env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY }) => {
  let storage;
  const saved = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  for (const [name, value] of Object.entries({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, ...env })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  jest.isolateModules(() => {
    storage = require("../../../services/storage");
  });
  Object.assign(process.env, saved);
  return storage;
};

// A minimal fetch Response.
const response = ({ ok = true, status = 200, json, text = "" } = {}) => ({
  ok,
  status,
  json: async () => json,
  text: async () => text,
});

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("toPublicFileUrl", () => {
  const storage = loadStorage();

  test("a stored object path becomes the bucket's public URL", () => {
    expect(storage.toPublicFileUrl("pet-images", "pets/5/photo 1.jpg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/pet-images/pets/5/photo%201.jpg`,
    );
  });

  test("an absolute URL (seeded pets) and empty values pass through unchanged", () => {
    expect(storage.toPublicFileUrl("pet-images", "https://cdn.test/a.webp")).toBe("https://cdn.test/a.webp");
    expect(storage.toPublicFileUrl("pet-images", null)).toBeNull();
    expect(storage.toPublicFileUrl("pet-images", "")).toBe("");
  });
});

describe("uploadPrivateFile", () => {
  test("POSTs the bytes with the service key, content type and no overwrite → the object path", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response());
    const buffer = Buffer.from("bytes");

    const path = await storage.uploadPrivateFile("government-ids", "adopters/7/id.jpg", buffer, "image/jpeg");

    expect(path).toBe("adopters/7/id.jpg");
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${SUPABASE_URL}/storage/v1/object/government-ids/adopters/7/id.jpg`);
    expect(options).toMatchObject({ method: "POST", body: buffer });
    expect(options.headers).toMatchObject({
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": "image/jpeg",
      "x-upsert": "false",
    });
  });

  test("{ upsert: true } overwrites; a missing content type falls back to octet-stream", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response());

    await storage.uploadPrivateFile("pet-images", "seed/a.webp", Buffer.from("x"), undefined, { upsert: true });

    expect(global.fetch.mock.calls[0][1].headers).toMatchObject({
      "Content-Type": "application/octet-stream",
      "x-upsert": "true",
    });
  });

  test("a non-2xx answer throws with the status and Supabase's message", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response({ ok: false, status: 409, text: "The resource already exists" }));

    await expect(storage.uploadPrivateFile("pet-images", "a.jpg", Buffer.from("x"), "image/jpeg")).rejects.toMatchObject({
      message: "Storage upload failed (409): The resource already exists",
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  test("an unreadable error body still throws, with an empty detail", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => { throw new Error("stream"); } });

    await expect(storage.uploadPrivateFile("pet-images", "a.jpg", Buffer.from("x"), "image/jpeg")).rejects.toThrow(
      "Storage upload failed (500): ",
    );
  });
});

describe("configuration checks", () => {
  test.each([
    [{ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: KEY }],
    [{ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: undefined }],
  ])("missing settings %j → a clear error, nothing sent", async (env) => {
    const storage = loadStorage(env);

    await expect(storage.uploadPrivateFile("pet-images", "a.jpg", Buffer.from("x"))).rejects.toThrow(
      "Supabase Storage is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("a placeholder URL → named in the error, nothing sent", async () => {
    const storage = loadStorage({ SUPABASE_URL: "your-project-url", SUPABASE_SERVICE_ROLE_KEY: KEY });

    await expect(storage.createSignedUrl("government-ids", "a.jpg")).rejects.toThrow(
      'SUPABASE_URL is not a valid URL: "your-project-url"',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("deletePrivateFile", () => {
  test("DELETEs the object with the service key", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response());

    await storage.deletePrivateFile("government-ids", "adopters/7/id.jpg");

    expect(global.fetch).toHaveBeenCalledWith(
      `${SUPABASE_URL}/storage/v1/object/government-ids/adopters/7/id.jpg`,
      { method: "DELETE", headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } },
    );
  });

  test("never throws — not on a network error, not when unconfigured", async () => {
    global.fetch.mockRejectedValue(new Error("ECONNRESET"));

    await expect(loadStorage().deletePrivateFile("pet-images", "a.jpg")).resolves.toBeUndefined();
    await expect(
      loadStorage({ SUPABASE_URL: undefined }).deletePrivateFile("pet-images", "a.jpg"),
    ).resolves.toBeUndefined();
  });
});

describe("createSignedUrl", () => {
  test("asks for a 5-minute link by default and returns it as an absolute URL", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(
      response({ json: { signedURL: "/object/sign/government-ids/a.jpg?token=abc" } }),
    );

    const url = await storage.createSignedUrl("government-ids", "a.jpg");

    expect(url).toBe(`${SUPABASE_URL}/storage/v1/object/sign/government-ids/a.jpg?token=abc`);
    const [requestUrl, options] = global.fetch.mock.calls[0];
    expect(requestUrl).toBe(`${SUPABASE_URL}/storage/v1/object/sign/government-ids/a.jpg`);
    expect(JSON.parse(options.body)).toEqual({ expiresIn: 300 });
  });

  test("a custom lifetime is passed through", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response({ json: { signedURL: "/object/sign/x" } }));

    await storage.createSignedUrl("government-ids", "a.jpg", 60);

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ expiresIn: 60 });
  });

  test("a non-2xx answer throws with the status", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response({ ok: false, status: 404, text: "Object not found" }));

    await expect(storage.createSignedUrl("government-ids", "a.jpg")).rejects.toThrow(
      "Failed to sign storage URL (404): Object not found",
    );
  });
});

describe("ensureBucket (setup only)", () => {
  test("creates a missing bucket → 'created'", async () => {
    const storage = loadStorage();
    global.fetch.mockResolvedValue(response());

    await expect(storage.ensureBucket("pet-images", { isPublic: true })).resolves.toBe("created");
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      id: "pet-images",
      name: "pet-images",
      public: true,
    });
  });

  test("an existing bucket with the right visibility → 'exists'", async () => {
    const storage = loadStorage();
    global.fetch
      .mockResolvedValueOnce(response({ ok: false, status: 409, text: "already exists" }))
      .mockResolvedValueOnce(response({ json: { public: false } }));

    await expect(storage.ensureBucket("government-ids", { isPublic: false })).resolves.toBe("exists");
    expect(global.fetch.mock.calls[1][0]).toBe(`${SUPABASE_URL}/storage/v1/bucket/government-ids`);
  });

  test("an existing bucket with the wrong visibility throws (a public government-ids would expose every ID)", async () => {
    const storage = loadStorage();
    global.fetch
      .mockResolvedValueOnce(response({ ok: false, status: 409 }))
      .mockResolvedValueOnce(response({ json: { public: true } }));

    await expect(storage.ensureBucket("government-ids", { isPublic: false })).rejects.toThrow(
      'Bucket "government-ids" exists but is public — it must be private. Change it in Supabase → Storage.',
    );
  });

  test("create fails and the bucket can't be found either → the create error", async () => {
    const storage = loadStorage();
    global.fetch
      .mockResolvedValueOnce(response({ ok: false, status: 403, text: "permission denied" }))
      .mockResolvedValueOnce(response({ ok: false, status: 404 }));

    await expect(storage.ensureBucket("pet-images", { isPublic: true })).rejects.toThrow(
      'Failed to create bucket "pet-images" (403): permission denied',
    );
  });
});
