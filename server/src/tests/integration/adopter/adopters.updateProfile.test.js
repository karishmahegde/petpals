const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Chained register + login + PUT round trips against the remote Supabase
// instance can exceed Jest's 5s default.
jest.setTimeout(20000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const registerAndLoginAdopter = async () => {
  const payload = {
    name: "Phone Update Test",
    email: uniqueEmail(),
    password: "Secret123!",
    role: "adopter",
  };
  const registerRes = await request(app)
    .post("/api/v1/auth/register")
    .send(payload);
  const userID = registerRes.body.data.userID;
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: payload.email, password: payload.password });
  return { userID, token: loginRes.body.data.token };
};

describe("PUT /api/v1/adopters/me", () => {
  test("a bare national number with no country code is rejected — ambiguous without a country", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ adopterPhone: "(212) 555-0105" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  test("a valid US number (with country code, in a common formatted style) normalizes to E.164", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ adopterPhone: "+1 (212) 555-0105" });

    expect(res.status).toBe(200);
    expect(res.body.data.adopterPhone).toBe("+12125550105");

    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.adopterPhone).toBe("+12125550105");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  test("a valid non-US number is stored correctly", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ adopterPhone: "+44 20 7183 8750" });

    expect(res.status).toBe(200);
    expect(res.body.data.adopterPhone).toBe("+442071838750");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  test("an invalid/malformed number returns 422 and stores nothing", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ adopterPhone: "not-a-phone-number" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.adopterPhone).toBeNull();

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  // —————————————————— AVATAR SEED ——————————————————
  test("a new avatarSeed is accepted, not silently stripped, and persists", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarSeed: "a-brand-new-seed-123" });

    expect(res.status).toBe(200);
    expect(res.body.data.avatarSeed).toBe("a-brand-new-seed-123");

    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.avatarSeed).toBe("a-brand-new-seed-123");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
