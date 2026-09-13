const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");

// Real Supabase Storage round trips (upload on POST, delete on cleanup) on top
// of the usual register + login + POST/GET chain — the 5s Jest default is
// too tight for that.
jest.setTimeout(20000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const registerAndLoginAdopter = async () => {
  const payload = {
    name: "Government ID Test Adopter",
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

// multipart/form-data submission — idType/idNumber as fields, a small
// in-memory buffer standing in for the scanned document (the endpoint only
// cares about declared mimetype, not real image content). Pass
// idType/idNumber as null to omit that field entirely (for the "missing
// field" case) rather than sending it empty.
const submitGovernmentId = (
  token,
  { idType = "Passport", idNumber = "AB1234567", attachFile = true } = {},
) => {
  let req = request(app)
    .post("/api/v1/adopters/me/government-id")
    .set("Authorization", `Bearer ${token}`);
  if (idType !== null) req = req.field("idType", idType);
  if (idNumber !== null) req = req.field("idNumber", idNumber);
  if (attachFile) {
    req = req.attach("file", Buffer.from("fake-id-scan-bytes"), {
      filename: "id.jpg",
      contentType: "image/jpeg",
    });
  }
  return req;
};

// Deletes the DB row + the object it points at (best-effort — some tests
// never get far enough to create either).
const cleanupAdopter = async (userID, documentURL) => {
  if (documentURL) {
    await storage
      .deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, documentURL)
      .catch(() => {});
  }
  await prisma.governmentID.deleteMany({ where: { userID } });
  await prisma.adopter.deleteMany({ where: { userID } });
  await prisma.users.deleteMany({ where: { userID } });
};

describe("POST /api/v1/adopters/me/government-id", () => {
  test("valid payload -> 201, record created with verificationStatus=Pending", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await submitGovernmentId(token, {
      idType: "Passport",
      idNumber: "AB1234567",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationStatus).toBe("Pending");
    expect(res.body.data.idType).toBe("Passport");

    const record = await prisma.governmentID.findFirst({
      where: { userID, userType: "Adopter" },
    });
    expect(record).not.toBeNull();
    expect(record.verificationStatus).toBe("Pending");
    expect(record.idNumber).toBe("AB1234567"); // stored in full — only the API response masks it

    await cleanupAdopter(userID, res.body.data.documentURL);
  });

  test("duplicate submission -> 409 CONFLICT", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const first = await submitGovernmentId(token);
    expect(first.status).toBe(201);

    const second = await submitGovernmentId(token, { idNumber: "ZZ9999999" });

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
    expect(second.body.error.code).toBe("CONFLICT");

    // Still just the one (original) record — the duplicate never landed.
    const records = await prisma.governmentID.findMany({
      where: { userID, userType: "Adopter" },
    });
    expect(records).toHaveLength(1);
    expect(records[0].idNumber).toBe("AB1234567");

    await cleanupAdopter(userID, first.body.data.documentURL);
  });

  test("missing idType -> 400 BAD_REQUEST", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await submitGovernmentId(token, { idType: null });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");

    const record = await prisma.governmentID.findFirst({ where: { userID } });
    expect(record).toBeNull();

    await cleanupAdopter(userID, null);
  });

  test("missing idNumber -> 400 BAD_REQUEST", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await submitGovernmentId(token, { idNumber: null });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");

    const record = await prisma.governmentID.findFirst({ where: { userID } });
    expect(record).toBeNull();

    await cleanupAdopter(userID, null);
  });
});

describe("GET /api/v1/adopters/me/government-id", () => {
  test("ID submitted -> returns status, never the raw idNumber", async () => {
    const { userID, token } = await registerAndLoginAdopter();
    const created = await submitGovernmentId(token, { idNumber: "CD5551234" });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get("/api/v1/adopters/me/government-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe("Pending");
    // Masked to only the last 4 characters — the raw number never leaves the API.
    expect(res.body.data.idNumber).toBe("*****1234");
    expect(res.body.data.idNumber).not.toBe("CD5551234");

    await cleanupAdopter(userID, created.body.data.documentURL);
  });

  test("no ID submitted -> 404 NOT_FOUND", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .get("/api/v1/adopters/me/government-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");

    await cleanupAdopter(userID, null);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
