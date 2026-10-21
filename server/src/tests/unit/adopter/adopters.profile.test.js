// The adopter's own account (adopters.controller.js + adopters.service.js):
// GET/PUT /adopters/me — every validation rule, the cached-match clearing and
// the database errors it maps — the /adopters/me list endpoints' query checks,
// and DELETE /adopters/me in both modes. Prisma is mocked; the list endpoints'
// own services are faked, since each has its own suite.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../config/prisma", () => ({
  adopter: { findUnique: jest.fn(), update: jest.fn() },
  adopterMatch: { deleteMany: jest.fn() },
  adoptionApplication: { findFirst: jest.fn() },
  governmentID: { findFirst: jest.fn() },
  users: { update: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));
jest.mock("../../../services/auth/accountNotices");
jest.mock("../../../services/storage", () => ({
  GOVERNMENT_IDS_BUCKET: "government-ids",
  deletePrivateFile: jest.fn(),
}));
jest.mock("../../../services/adopter/adoptionApplications.service", () => ({
  ...jest.requireActual("../../../services/adopter/adoptionApplications.service"),
  listApplicationsByAdopter: jest.fn(),
  listAdoptedPetsByAdopter: jest.fn(),
}));
jest.mock("../../../services/adopter/visits.service", () => ({
  ...jest.requireActual("../../../services/adopter/visits.service"),
  listVisitsByAdopter: jest.fn(),
}));
jest.mock("../../../services/adopter/appointments.service", () => ({
  ...jest.requireActual("../../../services/adopter/appointments.service"),
  listAppointmentsByAdopter: jest.fn(),
  getAppointmentDetailForAdopter: jest.fn(),
}));
jest.mock("../../../services/adopter/adoptedPets.service", () => ({
  ...jest.requireActual("../../../services/adopter/adoptedPets.service"),
  getAdoptedPetDetailForAdopter: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const accountNotices = require("../../../services/auth/accountNotices");
const storage = require("../../../services/storage");
const applicationsService = require("../../../services/adopter/adoptionApplications.service");
const visitsService = require("../../../services/adopter/visits.service");
const appointmentsService = require("../../../services/adopter/appointments.service");
const adoptedPetsService = require("../../../services/adopter/adoptedPets.service");
const app = require("../../../app");

const ADOPTER_ID = 7;
const auth = (role = "Adopter") => ({
  Authorization: `Bearer ${jwt.sign({ userID: ADOPTER_ID, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
});
const prismaError = (code) => Object.assign(new Error(code), { code });

// A row in ADOPTER_PROFILE_SELECT's shape.
const profileRow = (overrides = {}) => ({
  userID: ADOPTER_ID,
  adopterName: "Emelie",
  housingType: "House",
  yardAvailable: true,
  accountStatus: "Active",
  onboardingComplete: true,
  onboardingStep: 7,
  user: { userEmail: "emelie@example.com", emailVerified: true, lastLoginAt: null },
  ...overrides,
});

const put = (body) => request(app).put("/api/v1/adopters/me").set(auth()).send(body);

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  authService.getAccountStatus.mockResolvedValue("Active");
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ————————————————————— GET /adopters/me —————————————————————
describe("GET /api/v1/adopters/me", () => {
  test("the profile, with the account fields flattened from Users", async () => {
    prisma.adopter.findUnique.mockResolvedValue(profileRow());

    const res = await request(app).get("/api/v1/adopters/me").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      userID: ADOPTER_ID,
      adopterName: "Emelie",
      userEmail: "emelie@example.com",
      emailVerified: true,
      lastLoginAt: null,
    });
    expect(res.body.data).not.toHaveProperty("user");
    expect(res.body.data).not.toHaveProperty("stripeCustomerID");
  });

  test("no adopter row → 404", async () => {
    prisma.adopter.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/v1/adopters/me").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(`No adopter exists with ID ${ADOPTER_ID}`);
  });

  test("not an Adopter → 403", async () => {
    const res = await request(app).get("/api/v1/adopters/me").set(auth("Donor"));

    expect(res.status).toBe(403);
  });
});

// ————————————————————— PUT /adopters/me —————————————————————
describe("PUT /api/v1/adopters/me", () => {
  describe("validation (400, nothing written)", () => {
    test.each([
      [{ accountStatus: "Active" }, "These fields cannot be updated here: accountStatus"],
      [{ adopterRiskFlag: true, preQualifyFlag: true }, "These fields cannot be updated here: adopterRiskFlag, preQualifyFlag"],
      [{ onboardingStep: 7 }, "These fields cannot be updated here: onboardingStep"],
      [{ adopterName: null }, "adopterName cannot be null"],
      [{ housingType: "Castle" }, "housingType must be one of: Apartment, House, Other"],
      [{ preferredSize: "Huge" }, "preferredSize must be one of: Small, Medium, Large"],
      [{ householdSize: -1 }, "householdSize must be a non-negative integer"],
      [{ numChildren: 1.5 }, "numChildren must be a non-negative integer"],
      [{ yardAvailable: "yes" }, "yardAvailable must be a boolean"],
      [{ adopterName: "" }, "adopterName must be a non-empty string of at most 45 characters"],
      [{ zip: "1".repeat(11) }, "zip must be a non-empty string of at most 10 characters"],
      [{ city: 42 }, "city must be a non-empty string of at most 45 characters"],
      [{ adopterDOB: "not a date" }, "adopterDOB must be a valid date"],
      [{}, "No updatable fields provided"],
      [{ unknownField: "x" }, "No updatable fields provided"],
    ])("%j → %s", async (body, message) => {
      const res = await put(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(message);
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });

    test("an unparseable phone number → 422", async () => {
      const res = await put({ adopterPhone: "not a phone" });

      expect(res.status).toBe(422);
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });
  });

  test("a field the matcher doesn't use: a plain update, no transaction", async () => {
    prisma.adopter.update.mockResolvedValue(profileRow({ adopterName: "Em" }));

    const res = await put({ adopterName: "Em", unknownField: "ignored" });

    expect(res.status).toBe(200);
    expect(res.body.data.adopterName).toBe("Em");
    expect(prisma.adopter.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userID: ADOPTER_ID }, data: { adopterName: "Em" } }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.adopterMatch.deleteMany).not.toHaveBeenCalled();
  });

  test("a field the matcher scores on: update + cached matches cleared in one transaction", async () => {
    prisma.adopter.update.mockReturnValue("update-op");
    prisma.adopterMatch.deleteMany.mockReturnValue("clear-matches-op");
    prisma.$transaction.mockResolvedValue([profileRow({ yardAvailable: false }), { count: 3 }]);

    const res = await put({ yardAvailable: false });

    expect(res.status).toBe(200);
    expect(prisma.adopterMatch.deleteMany).toHaveBeenCalledWith({ where: { adopterID: ADOPTER_ID } });
    expect(prisma.$transaction).toHaveBeenCalledWith(["update-op", "clear-matches-op"]);
    expect(res.body.data.yardAvailable).toBe(false);
  });

  test("normalises the phone to E.164 and parses the date before saving", async () => {
    prisma.adopter.update.mockResolvedValue(profileRow());

    await put({ adopterPhone: "+1 (212) 555-0105", adopterDOB: "1990-04-02" });

    const { data } = prisma.adopter.update.mock.calls[0][0];
    expect(data.adopterPhone).toBe("+12125550105");
    expect(data.adopterDOB).toEqual(new Date("1990-04-02"));
  });

  test("a nullable field can be cleared", async () => {
    prisma.adopter.update.mockResolvedValue(profileRow());

    await put({ addressLine2: null, landlordContact: null });

    expect(prisma.adopter.update.mock.calls[0][0].data).toEqual({
      addressLine2: null,
      landlordContact: null,
    });
  });

  test("no adopter row (P2025) → 404", async () => {
    prisma.adopter.update.mockRejectedValue(prismaError("P2025"));

    const res = await put({ adopterName: "Em" });

    expect(res.status).toBe(404);
  });

  test("preferredBreedID pointing nowhere (P2003) → 400", async () => {
    // preferredBreedID is a matcher field, so the update runs in the transaction.
    prisma.adopter.update.mockReturnValue("update-op");
    prisma.$transaction.mockRejectedValue(prismaError("P2003"));

    const res = await put({ preferredBreedID: 999 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("preferredBreedID does not reference an existing record");
  });

  test("any other database error → 500", async () => {
    prisma.adopter.update.mockRejectedValue(new Error("connection lost"));

    const res = await put({ adopterName: "Em" });

    expect(res.status).toBe(500);
  });
});

// ————————————————————— list endpoints: query checks —————————————————————
describe("GET /api/v1/adopters/me/applications", () => {
  test("passes the filters and paging through", async () => {
    applicationsService.listApplicationsByAdopter.mockResolvedValue({
      data: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get("/api/v1/adopters/me/applications?status=Pending&petID=12&page=2&limit=5")
      .set(auth());

    expect(res.status).toBe(200);
    expect(applicationsService.listApplicationsByAdopter).toHaveBeenCalledWith(ADOPTER_ID, {
      status: "Pending",
      petID: 12,
      page: 2,
      limit: 5,
    });
  });

  test.each([
    ["page=0", "page must be an integer >= 1"],
    ["limit=101", "limit must be an integer between 1 and 100"],
    ["status=Approved", "status must be one of: Pending, Accepted, Rejected, Withdrawn"],
    ["petID=abc", "petID must be a positive integer"],
  ])("%s → 400", async (query, message) => {
    const res = await request(app).get(`/api/v1/adopters/me/applications?${query}`).set(auth());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(applicationsService.listApplicationsByAdopter).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/adopters/me/visits and /appointments", () => {
  test.each([
    ["visits", () => visitsService.listVisitsByAdopter],
    ["appointments", () => appointmentsService.listAppointmentsByAdopter],
  ])("%s: only the exact string 'true' turns on upcomingOnly", async (path, fn) => {
    fn().mockResolvedValue([]);

    await request(app).get(`/api/v1/adopters/me/${path}?upcoming=true`).set(auth());
    await request(app).get(`/api/v1/adopters/me/${path}?upcoming=yes`).set(auth());
    await request(app).get(`/api/v1/adopters/me/${path}`).set(auth());

    expect(fn().mock.calls.map(([, opts]) => opts.upcomingOnly)).toEqual([true, false, false]);
  });

  test.each([
    ["visits", () => visitsService.listVisitsByAdopter],
    ["appointments", () => appointmentsService.listAppointmentsByAdopter],
  ])("%s: a service error → 500", async (path, fn) => {
    fn().mockRejectedValue(new Error("connection lost"));

    const res = await request(app).get(`/api/v1/adopters/me/${path}`).set(auth());

    expect(res.status).toBe(500);
  });
});

describe("detail endpoints: id checks", () => {
  test.each([
    ["appointments/abc", "id must be a positive integer"],
    ["adopted-pets/0", "petId must be a positive integer"],
  ])("/adopters/me/%s → 400", async (path, message) => {
    const res = await request(app).get(`/api/v1/adopters/me/${path}`).set(auth());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });

  test("appointment and adopted-pet detail pass the caller and id through", async () => {
    appointmentsService.getAppointmentDetailForAdopter.mockResolvedValue({ appointmentID: 3 });
    adoptedPetsService.getAdoptedPetDetailForAdopter.mockResolvedValue({ petID: 12 });

    const a = await request(app).get("/api/v1/adopters/me/appointments/3").set(auth());
    const p = await request(app).get("/api/v1/adopters/me/adopted-pets/12").set(auth());

    expect(a.status).toBe(200);
    expect(p.status).toBe(200);
    expect(appointmentsService.getAppointmentDetailForAdopter).toHaveBeenCalledWith(ADOPTER_ID, 3);
    expect(adoptedPetsService.getAdoptedPetDetailForAdopter).toHaveBeenCalledWith(ADOPTER_ID, 12);
  });

  test("adopted pets list → 200 with the service's rows", async () => {
    applicationsService.listAdoptedPetsByAdopter.mockResolvedValue([{ petID: 12 }]);

    const res = await request(app).get("/api/v1/adopters/me/adopted-pets").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ petID: 12 }]);
  });
});

// ————————————————————— DELETE /adopters/me —————————————————————
describe("DELETE /api/v1/adopters/me", () => {
  const close = (body) => request(app).delete("/api/v1/adopters/me").set(auth()).send(body);
  const contact = { userID: ADOPTER_ID, email: "emelie@example.com", role: "Adopter", name: "Emelie" };

  beforeEach(() => {
    accountNotices.lookupContact.mockResolvedValue(contact);
  });

  test.each([[{}], [{ mode: "archive" }]])("mode %j → 422, nothing changed", async (body) => {
    const res = await close(body);

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("mode must be 'deactivate' or 'delete'");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test.each(["deactivate", "delete"])(
    "%s with an Accepted application on record → 409, nothing changed",
    async (mode) => {
      prisma.adoptionApplication.findFirst.mockResolvedValue({ applicationID: 4 });

      const res = await close({ mode });

      expect(res.status).toBe(409);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(accountNotices.accountClosed).not.toHaveBeenCalled();
    },
  );

  test("deactivate: Closed (not Deactivated) + signed out, then the notice", async () => {
    prisma.adoptionApplication.findFirst.mockResolvedValue(null);
    prisma.adopter.update.mockReturnValue("close-op");
    prisma.users.update.mockReturnValue("signout-op");
    prisma.$transaction.mockResolvedValue([]);

    const res = await close({ mode: "deactivate" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Account closed");
    expect(prisma.adopter.update).toHaveBeenCalledWith({
      where: { userID: ADOPTER_ID },
      data: { accountStatus: "Closed" },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(["close-op", "signout-op"]);
    expect(accountNotices.accountClosed).toHaveBeenCalledWith(contact, "deactivate");
  });

  describe("delete", () => {
    const tx = {
      governmentID: { deleteMany: jest.fn() },
      favorite: { deleteMany: jest.fn() },
      visit: { deleteMany: jest.fn() },
      adoptionApplication: { deleteMany: jest.fn() },
      adopter: { delete: jest.fn() },
      users: { delete: jest.fn() },
    };

    beforeEach(() => {
      prisma.adoptionApplication.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation((callback) => callback(tx));
    });

    test("removes the adopter's rows children first, then their ID document, then notifies", async () => {
      prisma.governmentID.findFirst.mockResolvedValue({ documentURL: "adopters/7/id-1.jpg" });

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deleted");
      for (const model of ["governmentID", "favorite", "visit", "adoptionApplication"]) {
        expect(tx[model].deleteMany).toHaveBeenCalled();
      }
      expect(tx.adopter.delete).toHaveBeenCalledWith({ where: { userID: ADOPTER_ID } });
      expect(tx.users.delete).toHaveBeenCalledWith({ where: { userID: ADOPTER_ID } });
      expect(storage.deletePrivateFile).toHaveBeenCalledWith("government-ids", "adopters/7/id-1.jpg");
      expect(accountNotices.accountClosed).toHaveBeenCalledWith(contact, "delete");
    });

    test("no ID document on file: nothing to remove from Storage", async () => {
      prisma.governmentID.findFirst.mockResolvedValue(null);

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(storage.deletePrivateFile).not.toHaveBeenCalled();
    });
  });
});
