const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — volunteers.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  volunteer: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  governmentID: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  appointment: { findFirst: jest.fn() },
  task: { findFirst: jest.fn() },
  volunteerEvent: { deleteMany: jest.fn() },
  volunteerTask: { deleteMany: jest.fn() },
  users: { update: jest.fn(), delete: jest.fn() },
  // The service passes an array of already-invoked prisma calls (each a
  // Promise) — Promise.all is a faithful enough stand-in.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// Private bucket — never actually hit; every call is asserted, not executed.
jest.mock("../../../services/storage", () => ({
  GOVERNMENT_IDS_BUCKET: "government-ids",
  uploadPrivateFile: jest.fn().mockResolvedValue(undefined),
  deletePrivateFile: jest.fn().mockResolvedValue(undefined),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const volunteerToken = (userID = 42) => signToken("Volunteer", userID);

// Matches VOLUNTEER_SELF_SELECT in volunteer/volunteers.service.js.
const buildVolunteerProfile = (overrides = {}) => ({
  userID: 42,
  avatarSeed: "seed-42",
  volunteerCode: "VOL-00042",
  volunteerName: "Sam Rivera",
  volunteerPhone: "+12125550119",
  shelterID: 5,
  volunteerDOB: "1985-03-14T00:00:00.000Z",
  volunteerSex: "M",
  volunteerSchedule: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  accountStatus: "Active",
  onboardingComplete: true,
  onboardingStep: 5,
  shelter: { shelterName: "PetPals Downtown" },
  user: { userEmail: "sam@petpals.org", emailVerified: true, lastLoginAt: null },
  ...overrides,
});

const buildGovernmentIdRow = (overrides = {}) => ({
  governmentIDID: 9,
  userID: 42,
  userType: "Volunteer",
  idType: "Passport",
  idNumber: "AB1234567",
  verificationStatus: "Pending",
  documentURL: "volunteer/42/id-123.jpg",
  ...overrides,
});

describe("Volunteer self-service endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /volunteers/me —————————————————————————————
  describe("GET /api/v1/volunteers/me", () => {
    test("returns the caller's own profile, email nested and login fields lifted", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(buildVolunteerProfile());

      const res = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.volunteer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42 } }),
      );
      expect(res.body.data).toMatchObject({
        volunteerCode: "VOL-00042",
        volunteerName: "Sam Rivera",
        emailVerified: true,
        user: { userEmail: "sam@petpals.org" },
      });
    });

    // The staff router's GET /volunteers/:id (Staff/Admin only) is mounted
    // after this one — /volunteers/me must never reach it.
    test("is answered by the self-service route, not the staff GET /volunteers/:id", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(buildVolunteerProfile());

      const res = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.volunteer.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.volunteer.findUnique.mock.calls[0][0].where).toEqual({ userID: 42 });
    });

    test("availability: decoded from the stored schedule; older free text → null, kept raw", async () => {
      prisma.volunteer.findUnique
        .mockResolvedValueOnce(buildVolunteerProfile({ volunteerSchedule: "Sat:MA" }))
        .mockResolvedValueOnce(buildVolunteerProfile({ volunteerSchedule: "Weekends" }));

      const structured = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);
      const legacy = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(structured.body.data.availability).toEqual({ Sat: ["Morning", "Afternoon"] });
      expect(legacy.body.data.availability).toBeNull();
      expect(legacy.body.data.volunteerSchedule).toBe("Weekends");
    });

    test("no volunteer row → 404 NOT_FOUND", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ————————————————————————————— PUT /volunteers/me —————————————————————————————
  describe("PUT /api/v1/volunteers/me", () => {
    const put = (body) =>
      request(app)
        .put("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send(body);

    test("valid partial update → 200, only the sent fields are written", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ volunteerName: "Sam R. Rivera" }),
      );

      const res = await put({ volunteerName: "Sam R. Rivera" });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { volunteerName: "Sam R. Rivera" },
        select: expect.any(Object),
      });
    });

    test("personal + address fields together → all written, DOB parsed, address trimmed", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(buildVolunteerProfile());

      const res = await put({
        volunteerDOB: "1985-03-14",
        volunteerSex: "F",
        addressLine1: " 1 Main St ",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "United States",
      });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update.mock.calls[0][0].data).toEqual({
        volunteerDOB: new Date("1985-03-14"),
        volunteerSex: "F",
        addressLine1: "1 Main St",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "United States",
      });
    });

    test("volunteerPhone is stored normalised to E.164", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(buildVolunteerProfile());

      const res = await put({ volunteerPhone: "+1 (212) 555-0119" });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { volunteerPhone: "+12125550119" } }),
      );
    });

    test("unparseable volunteerPhone → 422 VALIDATION_ERROR, nothing written", async () => {
      const res = await put({ volunteerPhone: "not-a-phone" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    test.each(["shelterID", "accountStatus"])(
      "disallowed field '%s' in body → 400 BAD_REQUEST, nothing written",
      async (field) => {
        const res = await put({ volunteerName: "Sam", [field]: "whatever" });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
          success: false,
          error: { code: "BAD_REQUEST" },
        });
        expect(prisma.volunteer.update).not.toHaveBeenCalled();
      },
    );

    test.each([
      ["no updatable fields", {}],
      ["invalid volunteerSex", { volunteerSex: "X" }],
      ["invalid volunteerDOB", { volunteerDOB: "not-a-date" }],
      ["volunteerName over 45 chars", { volunteerName: "x".repeat(46) }],
      ["volunteerName: null (non-nullable)", { volunteerName: null }],
      ["zip over 10 chars", { zip: "12345678901" }],
    ])("%s → 400 BAD_REQUEST, nothing written", async (_label, body) => {
      const res = await put(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    test("volunteerPhone: null clears it (nullable field) → written as null", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ volunteerPhone: null }),
      );

      const res = await put({ volunteerPhone: null });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { volunteerPhone: null } }),
      );
    });
  });

  // ——————————————————— PUT /volunteers/me/availability ———————————————————
  describe("PUT /api/v1/volunteers/me/availability", () => {
    const put = (body) =>
      request(app)
        .put("/api/v1/volunteers/me/availability")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send(body);

    test("stores the week compactly and returns it decoded", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ volunteerSchedule: "Mon:MA;Wed:E" }),
      );

      const res = await put({
        availability: { Wed: ["Evening"], Mon: ["Afternoon", "Morning"] },
      });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { volunteerSchedule: "Mon:MA;Wed:E" },
        select: expect.any(Object),
      });
      expect(res.body.data.availability).toEqual({
        Mon: ["Morning", "Afternoon"],
        Wed: ["Evening"],
      });
      expect(res.body.data.volunteerSchedule).toBe("Mon:MA;Wed:E");
    });

    test("{} clears it — stored as null", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(buildVolunteerProfile());

      const res = await put({ availability: {} });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update.mock.calls[0][0].data).toEqual({
        volunteerSchedule: null,
      });
      expect(res.body.data.availability).toEqual({});
    });

    test.each([
      ["missing availability", {}],
      ["unknown day", { availability: { Funday: ["Morning"] } }],
      ["unknown slot", { availability: { Mon: ["Midnight"] } }],
      ["slots not a list", { availability: { Mon: "Morning" } }],
    ])("%s → 400 BAD_REQUEST, nothing written", async (_label, body) => {
      const res = await put(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    test("a Pending volunteer can't set availability yet → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await put({ availability: { Mon: ["Morning"] } });

      expect(res.status).toBe(401);
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });
  });

  // ——————————————————— GET /volunteers/me/government-id ———————————————————
  describe("GET /api/v1/volunteers/me/government-id", () => {
    test("submitted → masked idNumber returned", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await request(app)
        .get("/api/v1/volunteers/me/government-id")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42, userType: "Volunteer" } }),
      );
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("none submitted → 404 NOT_FOUND", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/volunteers/me/government-id")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ——————————————————— POST /volunteers/me/government-id ———————————————————
  describe("POST /api/v1/volunteers/me/government-id", () => {
    const submit = () =>
      request(app)
        .post("/api/v1/volunteers/me/government-id")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .field("idType", "Passport")
        .field("idNumber", "AB1234567")
        .attach("file", Buffer.from("fake-id-bytes"), "id.jpg");

    test("first submission → 201, stored unmasked under volunteer/, returned masked", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.create.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      expect(storage.uploadPrivateFile).toHaveBeenCalledWith(
        "government-ids",
        expect.stringMatching(/^volunteer\/42\/id-\d+\.jpg$/),
        expect.any(Buffer),
        "image/jpeg",
      );
      expect(prisma.governmentID.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userID: 42,
            userType: "Volunteer",
            idNumber: "AB1234567", // stored in full — only the response masks it
          }),
        }),
      );
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("duplicate non-Rejected submission → 409 CONFLICT, nothing written", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("existing Rejected submission → resubmit overwrites the same row, resets to Pending, old file removed", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(
        buildGovernmentIdRow({
          verificationStatus: "Rejected",
          documentURL: "volunteer/42/id-old.jpg",
        }),
      );
      prisma.governmentID.update.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      expect(prisma.governmentID.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { governmentIDID: 9 },
          data: expect.objectContaining({ verificationStatus: "Pending" }),
        }),
      );
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
      expect(storage.deletePrivateFile).toHaveBeenCalledWith(
        "government-ids",
        "volunteer/42/id-old.jpg",
      );
    });

    test("missing file → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .post("/api/v1/volunteers/me/government-id")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .field("idType", "Passport")
        .field("idNumber", "AB1234567");

      expect(res.status).toBe(400);
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /volunteers/me/onboarding-step —————————————————————————————
  describe("PATCH /api/v1/volunteers/me/onboarding-step", () => {
    const advance = (step) =>
      request(app)
        .patch("/api/v1/volunteers/me/onboarding-step")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send({ step });

    test.each([
      ["advances to the next step", 2, 2, 3],
      ["never moves backward", 4, 2, 4],
      ["stops at the last step (5)", 5, 5, 5],
    ])("%s (at %i, completed %i → %i)", async (_label, current, step, expected) => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ onboardingStep: current });
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ onboardingStep: expected }),
      );

      const res = await advance(step);

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 42 },
          data: { onboardingStep: expected },
        }),
      );
    });

    test.each([1, 6, "abc", undefined])(
      "step %p → 400 BAD_REQUEST, nothing read or written",
      async (step) => {
        const res = await advance(step);

        expect(res.status).toBe(400);
        expect(prisma.volunteer.findUnique).not.toHaveBeenCalled();
        expect(prisma.volunteer.update).not.toHaveBeenCalled();
      },
    );
  });

  // ————————————————————————————— PATCH /volunteers/me/onboarding-complete —————————————————————————————
  describe("PATCH /api/v1/volunteers/me/onboarding-complete", () => {
    const complete = () =>
      request(app)
        .patch("/api/v1/volunteers/me/onboarding-complete")
        .set("Authorization", `Bearer ${volunteerToken()}`);

    const filledIn = {
      volunteerPhone: "+12125550119",
      volunteerDOB: new Date("1985-03-14"),
      volunteerSex: "M",
      addressLine1: "1 Main St",
      city: "New York",
      state: "New York",
      zip: "10001",
      country: "United States",
    };

    test("everything filled in and an ID submitted → 200, onboarding marked complete at step 5", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(filledIn);
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 9 });
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ onboardingComplete: true, onboardingStep: 5 }),
      );

      const res = await complete();

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42, userType: "Volunteer" } }),
      );
      expect(prisma.volunteer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { onboardingComplete: true, onboardingStep: 5 },
        }),
      );
    });

    test("missing fields and no ID → 409 naming each one, nothing written", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({
        ...filledIn,
        volunteerPhone: null,
        addressLine1: "",
        zip: "",
      });
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.message).toBe(
        "Onboarding is incomplete — missing: Phone, Address line 1, ZIP, Government ID",
      );
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    test("only the government ID missing → 409 naming just that", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(filledIn);
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Onboarding is incomplete — missing: Government ID",
      );
    });
  });

  // ————————————————————————————— PENDING VOLUNTEER (onboarding before approval) —————————————————————————————
  describe("a Pending volunteer", () => {
    beforeEach(() => {
      authService.getAccountStatus.mockResolvedValue("Pending");
    });

    test("can read their own profile", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(
        buildVolunteerProfile({ accountStatus: "Pending", onboardingComplete: false }),
      );

      const res = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(200);
    });

    test("can save their profile", async () => {
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ accountStatus: "Pending" }),
      );

      const res = await request(app)
        .put("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send({ volunteerSex: "M" });

      expect(res.status).toBe(200);
    });

    test("can save a wizard step", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ onboardingStep: 2 });
      prisma.volunteer.update.mockResolvedValueOnce(
        buildVolunteerProfile({ accountStatus: "Pending", onboardingStep: 3 }),
      );

      const res = await request(app)
        .patch("/api/v1/volunteers/me/onboarding-step")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send({ step: 2 });

      expect(res.status).toBe(200);
    });

    test("can check their government ID", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await request(app)
        .get("/api/v1/volunteers/me/government-id")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(200);
    });

    test("is blocked from a plain-authenticate route → 401", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(401);
    });
  });

  // ————————————————————————————— DELETE /volunteers/me —————————————————————————————
  describe("DELETE /api/v1/volunteers/me", () => {
    const close = (body) =>
      request(app)
        .delete("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send(body);

    const noOpenWork = () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.task.findFirst.mockResolvedValueOnce(null);
    };

    test("mode=deactivate → 200, leaves future events, status Deactivated, refresh token nulled, nothing deleted", async () => {
      noOpenWork();
      prisma.volunteerEvent.deleteMany.mockResolvedValueOnce({ count: 2 });
      prisma.volunteer.update.mockResolvedValueOnce({});
      prisma.users.update.mockResolvedValueOnce({});

      const res = await close({ mode: "deactivate" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deactivated");
      // Only events that haven't happened yet — past assignments stay as history.
      expect(prisma.volunteerEvent.deleteMany).toHaveBeenCalledWith({
        where: { volunteerID: 42, event: { eventDate: { gt: expect.any(Date) } } },
      });
      expect(prisma.volunteer.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { accountStatus: "Deactivated" },
      });
      expect(prisma.users.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { refreshToken: null },
      });
      expect(prisma.volunteerTask.deleteMany).not.toHaveBeenCalled();
      expect(prisma.volunteer.delete).not.toHaveBeenCalled();
      expect(prisma.governmentID.deleteMany).not.toHaveBeenCalled();
    });

    test("mode=delete → 200, every task/event assignment, ID, volunteer + users rows removed, then the stored file", async () => {
      noOpenWork();
      prisma.governmentID.findFirst.mockResolvedValueOnce({ documentURL: "volunteer/42/id-1.jpg" });
      prisma.volunteerEvent.deleteMany.mockResolvedValue({ count: 0 });
      prisma.volunteerTask.deleteMany.mockResolvedValueOnce({ count: 3 });
      prisma.governmentID.deleteMany.mockResolvedValueOnce({ count: 1 });
      prisma.volunteer.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deleted");
      // Both join tables' FKs to Volunteer are RESTRICT — every row has to go.
      expect(prisma.volunteerEvent.deleteMany).toHaveBeenCalledWith({ where: { volunteerID: 42 } });
      expect(prisma.volunteerTask.deleteMany).toHaveBeenCalledWith({ where: { volunteerID: 42 } });
      expect(prisma.governmentID.deleteMany).toHaveBeenCalledWith({
        where: { userID: 42, userType: "Volunteer" },
      });
      expect(prisma.volunteer.delete).toHaveBeenCalledWith({ where: { userID: 42 } });
      expect(prisma.users.delete).toHaveBeenCalledWith({ where: { userID: 42 } });
      expect(storage.deletePrivateFile).toHaveBeenCalledWith("government-ids", "volunteer/42/id-1.jpg");
    });

    test("mode=delete with no government ID → nothing to remove from storage", async () => {
      noOpenWork();
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.volunteerEvent.deleteMany.mockResolvedValue({ count: 0 });
      prisma.volunteerTask.deleteMany.mockResolvedValueOnce({ count: 0 });
      prisma.governmentID.deleteMany.mockResolvedValueOnce({ count: 0 });
      prisma.volunteer.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(storage.deletePrivateFile).not.toHaveBeenCalled();
    });

    test.each([
      ["upcoming appointments", { appointmentID: 11 }, null, "You have upcoming appointments — ask your shelter's staff to reassign them before closing your account", ["appointments"]],
      ["open tasks", null, { taskID: 7 }, "You have open tasks — ask your shelter's staff to reassign them before closing your account", ["tasks"]],
      ["both", { appointmentID: 11 }, { taskID: 7 }, "You have upcoming appointments and open tasks — ask your shelter's staff to reassign them before closing your account", ["appointments", "tasks"]],
    ])("%s → 409 for either mode, nothing written", async (_label, appointment, task, message, blockers) => {
      for (const mode of ["deactivate", "delete"]) {
        jest.clearAllMocks();
        prisma.appointment.findFirst.mockResolvedValueOnce(appointment);
        prisma.task.findFirst.mockResolvedValueOnce(task);

        const res = await close({ mode });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("CONFLICT");
        expect(res.body.message).toBe(message);
        expect(res.body.error.details).toEqual({ blockers });
        expect(prisma.volunteerEvent.deleteMany).not.toHaveBeenCalled();
        expect(prisma.volunteer.update).not.toHaveBeenCalled();
        expect(prisma.volunteer.delete).not.toHaveBeenCalled();
        expect(prisma.users.delete).not.toHaveBeenCalled();
      }
    });

    test("the open-work checks look at the right rows", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce({ appointmentID: 11 });
      prisma.task.findFirst.mockResolvedValueOnce(null);

      await close({ mode: "deactivate" });

      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
        volunteerID: 42,
        appointmentStatus: "Scheduled",
        appointmentDate: { gt: expect.any(Date) },
      });
      expect(prisma.task.findFirst.mock.calls[0][0].where).toEqual({
        taskStatus: "In_progress",
        volunteers: { some: { volunteerID: 42 } },
      });
    });

    test.each([undefined, "archive"])(
      "mode %p → 422 VALIDATION_ERROR, nothing read or written",
      async (mode) => {
        const res = await close(mode === undefined ? {} : { mode });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
      },
    );

    test("a Pending volunteer can't close their account here → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(401);
      expect(prisma.volunteer.delete).not.toHaveBeenCalled();
    });

    test("Staff role → 403", async () => {
      const res = await request(app)
        .delete("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ mode: "delete" });

      expect(res.status).toBe(403);
      expect(prisma.volunteer.delete).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/volunteers/me"],
      ["put", "/api/v1/volunteers/me"],
      ["put", "/api/v1/volunteers/me/availability"],
      ["get", "/api/v1/volunteers/me/government-id"],
      ["post", "/api/v1/volunteers/me/government-id"],
      ["patch", "/api/v1/volunteers/me/onboarding-step"],
      ["patch", "/api/v1/volunteers/me/onboarding-complete"],
    ])("%s %s: Staff role → 403 FORBIDDEN, nothing written", async (method, path) => {
      const res = await request(app)
        [method](path)
        .set("Authorization", `Bearer ${signToken("Staff")}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });

    test("Staff can still use the staff GET /volunteers/:id alongside it", async () => {
      // Not a full staff-route test (see unit/staff/volunteers.management) —
      // just that mounting /volunteers/me first didn't shadow it.
      const res = await request(app)
        .get("/api/v1/volunteers/abc")
        .set("Authorization", `Bearer ${signToken("Staff")}`);

      expect(res.status).toBe(400); // the staff route's id validation
    });

    test("a Pending Staff member can't reach /volunteers/me either → 403", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await request(app)
        .get("/api/v1/volunteers/me")
        .set("Authorization", `Bearer ${signToken("Staff")}`);

      expect(res.status).toBe(403);
    });
  });
});
