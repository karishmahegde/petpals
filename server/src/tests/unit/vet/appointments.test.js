const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => {
  const client = {
    appointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    healthRecord: { create: jest.fn() },
  };
  // Interactive transaction — the callback gets the same mocked client as tx.
  client.$transaction = jest.fn((fn) => fn(client));
  return client;
});

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 70) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const vetToken = () => signToken("Veterinarian");

const DAY = 24 * 60 * 60 * 1000;

const petRow = {
  petID: 5,
  petCode: "PE000005",
  petName: "Rex",
  petPhoto: null,
  breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
};

// Matches LIST_SELECT in staff/appointments.service.js.
const listRow = (overrides = {}) => ({
  appointmentID: 11,
  appointmentDate: new Date(Date.now() + 3 * DAY),
  appointmentReason: "Annual check-up",
  appointmentStatus: "Scheduled",
  pet: petRow,
  vet: { vetName: "Jay Asarathi" },
  ...overrides,
});

const detailRow = (overrides = {}) => ({
  ...listRow(),
  appointmentCode: "APT-00011",
  shelter: { shelterID: 1, shelterName: "PetPals Downtown" },
  staff: { staffName: "Sasha Lee" },
  volunteer: null,
  vaccinations: [
    {
      recordID: 3,
      administeredDate: new Date("2026-09-01"),
      dueDate: new Date("2027-09-01"),
      vaccine: { vaccineName: "Rabies" },
    },
  ],
  healthRecords: [
    { recordID: 8, recordDesc: "Healthy weight.", createdAt: new Date("2026-09-01") },
  ],
  ...overrides,
});

const list = (query = {}) =>
  request(app)
    .get("/api/v1/vets/me/appointments")
    .query(query)
    .set("Authorization", `Bearer ${vetToken()}`);

describe("Veterinarian appointment queue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /vets/me/appointments —————————————————————————————
  describe("GET /api/v1/vets/me/appointments", () => {
    test("upcoming=true → only the caller's Scheduled future appointments, soonest first, staff list-item shape", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([listRow()]);
      prisma.appointment.count.mockResolvedValueOnce(1);

      const res = await list({ upcoming: "true" });

      expect(res.status).toBe(200);
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        vetID: 70,
        appointmentStatus: "Scheduled",
        appointmentDate: { gt: expect.any(Date) },
      });
      expect(args.orderBy).toEqual({ appointmentDate: "asc" });
      expect(res.body.data).toEqual([
        {
          appointmentID: 11,
          appointmentDate: expect.any(String),
          appointmentReason: "Annual check-up",
          status: "Scheduled",
          pet: {
            petID: 5,
            petCode: "PE000005",
            petName: "Rex",
            petPhoto: null,
            breedName: "Beagle",
            speciesName: "Dog",
          },
          vetName: "Jay Asarathi",
        },
      ]);
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    test("default (past) → past-dated or Cancelled, most recent first; a past Scheduled row reads Completed", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([
        listRow({ appointmentDate: new Date(Date.now() - DAY) }),
        listRow({ appointmentID: 12, appointmentStatus: "Cancelled" }),
      ]);
      prisma.appointment.count.mockResolvedValueOnce(2);

      const res = await list();

      expect(res.status).toBe(200);
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        vetID: 70,
        OR: [
          { appointmentDate: { lte: expect.any(Date) } },
          { appointmentStatus: "Cancelled" },
        ],
      });
      expect(args.orderBy).toEqual({ appointmentDate: "desc" });
      expect(res.body.data.map((a) => a.status)).toEqual(["Completed", "Cancelled"]);
    });

    test("petName is a case-insensitive contains match; page/limit paginate", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([]);
      prisma.appointment.count.mockResolvedValueOnce(45);

      const res = await list({ upcoming: "false", petName: " rex ", page: "3", limit: "10" });

      expect(res.status).toBe(200);
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where.pet).toEqual({ petName: { contains: "rex", mode: "insensitive" } });
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
      expect(res.body.pagination).toEqual({ page: 3, limit: 10, total: 45, totalPages: 5 });
    });

    test.each([
      ["upcoming=yes", { upcoming: "yes" }],
      ["page=0", { page: "0" }],
      ["page=abc", { page: "abc" }],
      ["limit=0", { limit: "0" }],
      ["limit=101", { limit: "101" }],
    ])("%s → 400 BAD_REQUEST, nothing queried", async (_label, query) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /vets/me/appointments/:id —————————————————————————————
  describe("GET /api/v1/vets/me/appointments/:id", () => {
    const get = (id) =>
      request(app)
        .get(`/api/v1/vets/me/appointments/${id}`)
        .set("Authorization", `Bearer ${vetToken()}`);

    test("own appointment → pet, shelter, reason, status and linked vaccinations", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(detailRow());

      const res = await get(11);

      expect(res.status).toBe(200);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
        appointmentID: 11,
        vetID: 70,
      });
      expect(res.body.data).toMatchObject({
        appointmentID: 11,
        appointmentCode: "APT-00011",
        appointmentReason: "Annual check-up",
        status: "Scheduled",
        pet: { petCode: "PE000005", petName: "Rex", breedName: "Beagle", speciesName: "Dog" },
        shelterID: 1,
        shelterName: "PetPals Downtown",
        staffName: "Sasha Lee",
        volunteerName: null,
        vaccinesAdministered: [
          { recordID: 3, vaccineName: "Rabies", administeredDate: expect.any(String), dueDate: expect.any(String) },
        ],
        healthRecords: [
          { recordID: 8, recordDesc: "Healthy weight.", createdAt: expect.any(String) },
        ],
      });
      expect(res.body.data).not.toHaveProperty("adopter");
    });

    test("another vet's (or a missing) appointment → 404 NOT_FOUND", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);

      const res = await get(99);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.message).toBe("No appointment exists with ID 99");
    });

    test("non-numeric id → 400, nothing queried", async () => {
      const res = await get("abc");

      expect(res.status).toBe(400);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /appointments/:id/status —————————————————————————————
  describe("PATCH /api/v1/appointments/:id/status", () => {
    const complete = (body, id = 11, token = vetToken()) =>
      request(app)
        .patch(`/api/v1/appointments/${id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    // What completeAppointment's findFirst reads.
    const stored = (overrides = {}) => ({
      petID: 5,
      appointmentStatus: "Scheduled",
      appointmentDate: new Date(Date.now() - DAY),
      ...overrides,
    });

    test("assigned vet, past Scheduled → Completed written, detail returned, no health record without notes", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(stored());
      prisma.appointment.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.appointment.findFirst.mockResolvedValueOnce(
        detailRow({
          appointmentStatus: "Completed",
          appointmentDate: new Date(Date.now() - DAY),
        }),
      );

      const res = await complete({ appointmentStatus: "Completed" });

      expect(res.status).toBe(200);
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { appointmentID: 11, appointmentStatus: "Scheduled" },
        data: { appointmentStatus: "Completed" },
      });
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
      expect(res.body.data.status).toBe("Completed");
    });

    test("notes → a HealthRecord for the pet (vetID = caller), linked to the appointment, in the same transaction", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(stored());
      prisma.appointment.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.healthRecord.create.mockResolvedValueOnce({ recordID: 1 });
      prisma.appointment.findFirst.mockResolvedValueOnce(detailRow({ appointmentStatus: "Completed" }));

      const res = await complete({
        appointmentStatus: "Completed",
        notes: "  Healthy weight, mild tartar.  ",
      });

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.healthRecord.create).toHaveBeenCalledWith({
        data: { petID: 5, vetID: 70, appointmentID: 11, recordDesc: "Healthy weight, mild tartar." },
      });
    });

    test("blank notes → no health record", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(stored());
      prisma.appointment.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.appointment.findFirst.mockResolvedValueOnce(detailRow({ appointmentStatus: "Completed" }));

      const res = await complete({ appointmentStatus: "Completed", notes: "   " });

      expect(res.status).toBe(200);
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
    });

    test.each([
      ["missing appointmentStatus", {}],
      ["appointmentStatus Cancelled", { appointmentStatus: "Cancelled" }],
      ["appointmentStatus Scheduled", { appointmentStatus: "Scheduled" }],
      ["legacy key 'status'", { status: "Completed" }],
      ["notes not a string", { appointmentStatus: "Completed", notes: 42 }],
      ["notes over 500 chars", { appointmentStatus: "Completed", notes: "x".repeat(501) }],
    ])("%s → 400 BAD_REQUEST, nothing read or written", async (_label, body) => {
      const res = await complete(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
      expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    });

    test("another vet's (or a missing) appointment → 404, scoped by vetID in the query, nothing written", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);

      const res = await complete({ appointmentStatus: "Completed" }, 99);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.message).toBe("No appointment exists with ID 99");
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
        appointmentID: 99,
        vetID: 70,
      });
      expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    });

    test.each(["Cancelled", "Completed"])(
      "stored %s → 409, nothing written",
      async (appointmentStatus) => {
        prisma.appointment.findFirst.mockResolvedValueOnce(stored({ appointmentStatus }));

        const res = await complete({ appointmentStatus: "Completed" });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(`A ${appointmentStatus} appointment can't be completed`);
        expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
      },
    );

    test("appointmentDate still in the future → 409, nothing written", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(
        stored({ appointmentDate: new Date(Date.now() + DAY) }),
      );

      const res = await complete({ appointmentStatus: "Completed", notes: "Too early" });

      expect(res.status).toBe(409);
      expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
    });

    test("lost a race (no longer Scheduled at write time) → 409, no health record", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(stored());
      prisma.appointment.updateMany.mockResolvedValueOnce({ count: 0 });

      const res = await complete({ appointmentStatus: "Completed", notes: "Checked teeth" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("This appointment is no longer Scheduled");
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
    });

    test.each(["Staff", "Admin"])("%s role → 403, nothing read", async (role) => {
      const res = await complete({ appointmentStatus: "Completed" }, 11, signToken(role));

      expect(res.status).toBe(403);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    test("the Staff cancel route is untouched — a vet can't use it → 403", async () => {
      const res = await request(app)
        .patch("/api/v1/appointments/11/cancel")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(403);
    });
  });

  // ————————————————————————————— ACCESS —————————————————————————————
  describe("access", () => {
    test.each([
      ["/api/v1/vets/me/appointments"],
      ["/api/v1/vets/me/appointments/11"],
    ])("%s: Staff role → 403 FORBIDDEN", async (path) => {
      const res = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${signToken("Staff")}`);

      expect(res.status).toBe(403);
      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    test("a Pending vet can't see the queue → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await list();

      expect(res.status).toBe(401);
      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
    });
  });
});
