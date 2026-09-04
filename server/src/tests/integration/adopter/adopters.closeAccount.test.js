const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Each test chains several HTTP + live-DB round trips against the remote
// Supabase instance — the 5s Jest default is too tight for that.
jest.setTimeout(20000);

// Runs against the DATABASE_URL configured in server/.env, same convention as
// auth.login.test.js — seeds via API calls where an endpoint exists, cleans up
// via Prisma in afterAll.
const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const registerAndLoginAdopter = async () => {
  const payload = {
    name: "Close Account Test",
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
  return {
    userID,
    email: payload.email,
    password: payload.password,
    token: loginRes.body.data.token,
  };
};

describe("DELETE /api/v1/adopters/me", () => {
  let shelterID;
  let petID;
  let speciesID;
  let breedID;

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `CloseAcctTestSpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "CloseAcctTestBreed" },
    });
    breedID = breed.breedID;

    const shelter = await prisma.shelter.create({
      data: {
        shelterName: "Close Account Test Shelter",
        shelterAddress: "123 Test St",
        shelterPhone: "555-0100",
        shelterEmail: `shelter${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 10,
      },
    });
    shelterID = shelter.shelterID;

    const pet = await prisma.pet.create({
      data: {
        petName: "Testy",
        breedID,
        petDOB: new Date("2020-01-01"),
        petWeight: 10,
        petHeight: 10,
        petBGroup: "N/A",
        petColor: "Brown",
        petPhoto: "placeholder.jpg",
        petSex: "M",
        intakeDate: new Date(),
        shelterID,
        adoptionStatus: "available",
      },
    });
    petID = pet.petID;
  });

  afterAll(async () => {
    await prisma.pet.deleteMany({ where: { petID } });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.shelter.deleteMany({ where: { shelterID } });
    await prisma.$disconnect();
  });

  // —————————————————— DEACTIVATE ——————————————————
  test("deactivate with no Accepted application returns 200, sets accountStatus, nulls refreshToken, and blocks future login", async () => {
    const { userID, email, password, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .delete("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "deactivate" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Account deactivated" });

    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.accountStatus).toBe("Deactivated");

    const user = await prisma.users.findUnique({ where: { userID } });
    expect(user.refreshToken).toBeNull();

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.message).toMatch(/deactivated/i);

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  // —————————————————— DELETE ——————————————————
  test("delete with no Accepted application removes favorites, visits, applications, government ID, and the adopter/users rows", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const favRes = await request(app)
      .post(`/api/v1/pets/${petID}/favorites`)
      .set("Authorization", `Bearer ${token}`);
    expect(favRes.status).toBe(201);

    const visitRes = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", `Bearer ${token}`)
      .send({
        shelterID,
        visitTime: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(visitRes.status).toBe(201);

    const appRes = await request(app)
      .post("/api/v1/adoption-applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ petID, shelterID });
    expect(appRes.status).toBe(201);

    // Simulates a submitted government ID without a real Storage upload —
    // deletePrivateFile is best-effort and swallows failures on a fake path.
    await prisma.governmentID.create({
      data: {
        userID,
        userType: "Adopter",
        idType: "Passport",
        idNumber: "X1234567",
        documentURL: `adopter/${userID}/id-test.jpg`,
      },
    });

    const res = await request(app)
      .delete("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "delete" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Account deleted" });

    const [favorites, visits, applications, governmentIds, adopter, user] =
      await Promise.all([
        prisma.favorite.findMany({ where: { adopterID: userID } }),
        prisma.visit.findMany({ where: { adopterID: userID } }),
        prisma.adoptionApplication.findMany({ where: { adopterID: userID } }),
        prisma.governmentID.findMany({ where: { userID, userType: "Adopter" } }),
        prisma.adopter.findUnique({ where: { userID } }),
        prisma.users.findUnique({ where: { userID } }),
      ]);

    expect(favorites).toHaveLength(0);
    expect(visits).toHaveLength(0);
    expect(applications).toHaveLength(0);
    expect(governmentIds).toHaveLength(0);
    expect(adopter).toBeNull();
    expect(user).toBeNull();
  });

  // —————————————————— GUARD: ACCEPTED APPLICATION ——————————————————
  describe.each(["deactivate", "delete"])("%s blocked by an active adoption", (mode) => {
    test(`returns 409 and changes no data`, async () => {
      const { userID, token } = await registerAndLoginAdopter();

      const appRes = await request(app)
        .post("/api/v1/adoption-applications")
        .set("Authorization", `Bearer ${token}`)
        .send({ petID, shelterID });
      expect(appRes.status).toBe(201);
      const applicationID = appRes.body.data.applicationID;

      await prisma.adoptionApplication.update({
        where: { applicationID },
        data: { applicationStatus: "Accepted" },
      });

      const res = await request(app)
        .delete("/api/v1/adopters/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ mode });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.message).toMatch(/active adoption/i);

      const adopter = await prisma.adopter.findUnique({ where: { userID } });
      expect(adopter).not.toBeNull();
      expect(adopter.accountStatus).not.toBe("Deactivated");

      await prisma.adoptionApplication.deleteMany({ where: { adopterID: userID } });
      await prisma.adopter.deleteMany({ where: { userID } });
      await prisma.users.deleteMany({ where: { userID } });
    });
  });

  // —————————————————— VALIDATION ——————————————————
  test.each([
    ["missing mode", {}],
    ["invalid mode", { mode: "wipe" }],
  ])("%s returns 422 VALIDATION_ERROR", async (_label, body) => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .delete("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  // —————————————————— TRANSACTION ROLLBACK ——————————————————
  test("a failure mid-delete rolls back favorites and visits deletion", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const favRes = await request(app)
      .post(`/api/v1/pets/${petID}/favorites`)
      .set("Authorization", `Bearer ${token}`);
    expect(favRes.status).toBe(201);
    const visitRes = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", `Bearer ${token}`)
      .send({
        shelterID,
        visitTime: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(visitRes.status).toBe(201);

    // Wraps the REAL $transaction (so favorite/visit deletes actually run
    // inside a live DB transaction) but monkey-patches adoptionApplication's
    // deleteMany on that one transaction client to throw mid-sequence —
    // proving Prisma rolls back everything already executed in the tx, not
    // just skipping the failed step.
    const originalTransaction = prisma.$transaction.bind(prisma);
    const spy = jest
      .spyOn(prisma, "$transaction")
      .mockImplementation((cb) =>
        originalTransaction(async (tx) => {
          tx.adoptionApplication.deleteMany = () => {
            throw new Error("simulated failure");
          };
          return cb(tx);
        }),
      );

    const res = await request(app)
      .delete("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "delete" });

    spy.mockRestore();

    expect(res.status).toBe(500);

    const [favorites, visits, adopter] = await Promise.all([
      prisma.favorite.findMany({ where: { adopterID: userID } }),
      prisma.visit.findMany({ where: { adopterID: userID } }),
      prisma.adopter.findUnique({ where: { userID } }),
    ]);
    expect(favorites.length).toBeGreaterThan(0);
    expect(visits.length).toBeGreaterThan(0);
    expect(adopter).not.toBeNull();

    await prisma.favorite.deleteMany({ where: { adopterID: userID } });
    await prisma.visit.deleteMany({ where: { adopterID: userID } });
    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });
});
