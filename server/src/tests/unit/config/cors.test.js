const request = require("supertest");
const { parseCorsOrigins } = require("../../../config/cors");

describe("parseCorsOrigins", () => {
  test("nothing set → the local dev client", () => {
    expect(parseCorsOrigins({})).toEqual(["http://localhost:3000"]);
  });

  test("CLIENT_URL alone → that one origin, trailing slash dropped", () => {
    expect(parseCorsOrigins({ CLIENT_URL: "https://petpals.vercel.app/" })).toEqual([
      "https://petpals.vercel.app",
    ]);
  });

  test("CORS_ORIGINS replaces CLIENT_URL: comma-separated, spaces and empty entries ignored", () => {
    expect(
      parseCorsOrigins({
        CLIENT_URL: "https://petpals.vercel.app",
        CORS_ORIGINS: " https://petpals.vercel.app , https://preview.vercel.app/,, ",
      }),
    ).toEqual(["https://petpals.vercel.app", "https://preview.vercel.app"]);
  });

  test("a CORS_ORIGINS of only commas and spaces → the local dev client, never an empty list", () => {
    expect(parseCorsOrigins({ CORS_ORIGINS: " , " })).toEqual(["http://localhost:3000"]);
  });
});

describe("the app's CORS policy", () => {
  const app = require("../../../app");
  const [allowed] = parseCorsOrigins();

  test("a preflight from an allowed origin → that origin echoed back, with credentials", async () => {
    const res = await request(app)
      .options("/api/v1/notifications/stream")
      .set("Origin", allowed)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("a preflight from any other origin → no allow-origin header, so the browser blocks it", async () => {
    const res = await request(app)
      .options("/api/v1/notifications/stream")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
