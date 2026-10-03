const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  vaccine: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  appointment: { findFirst: jest.fn() },
  staff: { findUnique: jest.fn() },
  vaccinationRecord: { findMany: jest.fn(), create: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const vetToken = () => signToken("Veterinarian", 70);
const staffToken = () => signToken("Staff", 42);
const adminToken = () => signToken("Admin", 1);

const DAY = 24 * 60 * 60 * 1000;

// What loadAppointmentFor reads.
const appointment = (overrides = {}) => ({
  petID: 5,
  shelterID: 1,
  appointmentStatus: "Scheduled",
  ...overrides,
});

// Matches DOSE_SELECT in vaccinations.service.js.
const doseRow = (overrides = {}) => ({
  recordID: 9,
  appointmentID: 11,
  administeredDate: new Date("2026-09-30T10:00:00Z"),
  dueDate: new Date("2027-09-30T10:00:00Z"),
  vaccine: { vaccineID: 2, vaccineName: "Rabies" },
  vet: { vetName: "Jay Asarathi" },
  shelter: { shelterName: "PetPals Downtown" },
  ...overrides,
});

describe("Vaccine catalog + appointment vaccinations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /vaccines —————————————————————————————
  describe("GET /api/v1/vaccines", () => {
    test.each([
      ["Veterinarian", vetToken],
      ["Staff", staffToken],
      ["Admin", adminToken],
    ])("%s → the catalog, alphabetical", async (_role, token) => {
      prisma.vaccine.findMany.mockResolvedValueOnce([
        { vaccineID: 3, vaccineName: "Bordetella", manufacturer: "Merck", vaccineDesc: "Kennel cough." },
      ]);

      const res = await request(app)
        .get("/api/v1/vaccines")
        .set("Authorization", `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(prisma.vaccine.findMany.mock.calls[0][0].orderBy).toEqual({ vaccineName: "asc" });
      expect(res.body.data).toEqual([
        { vaccineID: 3, vaccineName: "Bordetella", manufacturer: "Merck", vaccineDesc: "Kennel cough." },
      ]);
    });

    test("?name= → case-insensitive contains match on vaccineName, trimmed", async () => {
      prisma.vaccine.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/vaccines")
        .query({ name: "  rab " })
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.vaccine.findMany.mock.calls[0][0].where).toEqual({
        vaccineName: { contains: "rab", mode: "insensitive" },
      });
    });

    test("no name (or a blank one) → unfiltered", async () => {
      prisma.vaccine.findMany.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/vaccines")
        .query({ name: "   " })
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(prisma.vaccine.findMany.mock.calls[0][0].where).toEqual({});
    });

    test.each(["Adopter", "Volunteer", "Donor"])("%s → 403", async (role) => {
      const res = await request(app)
        .get("/api/v1/vaccines")
        .set("Authorization", `Bearer ${signToken(role, 7)}`);

      expect(res.status).toBe(403);
      expect(prisma.vaccine.findMany).not.toHaveBeenCalled();
    });
  });

  // Matches VACCINE_SELECT in vaccinations.service.js.
  const vaccineRow = (overrides = {}) => ({
    vaccineID: 3,
    vaccineName: "Bird Flu 2KZZ",
    manufacturer: "Pfizer",
    vaccineDesc: "Bi-yearly vaccine for bird flu",
    ...overrides,
  });

  // ————————————————————————————— POST /vaccines —————————————————————————————
  describe("POST /api/v1/vaccines", () => {
    const post = (body, token = vetToken()) =>
      request(app)
        .post("/api/v1/vaccines")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    test.each([
      ["Veterinarian", vetToken],
      ["Admin", adminToken],
    ])("%s → 201, fields trimmed, the created vaccine back", async (_role, token) => {
      prisma.vaccine.findFirst.mockResolvedValueOnce(null);
      prisma.vaccine.create.mockResolvedValueOnce(vaccineRow());

      const res = await post(
        {
          vaccineName: "  Bird Flu 2KZZ ",
          manufacturer: " Pfizer ",
          vaccineDesc: "Bi-yearly vaccine for bird flu",
        },
        token(),
      );

      expect(res.status).toBe(201);
      expect(prisma.vaccine.create.mock.calls[0][0].data).toEqual({
        vaccineName: "Bird Flu 2KZZ",
        manufacturer: "Pfizer",
        vaccineDesc: "Bi-yearly vaccine for bird flu",
      });
      expect(res.body.data).toEqual(vaccineRow());
    });

    test("blank optional fields are stored as null", async () => {
      prisma.vaccine.findFirst.mockResolvedValueOnce(null);
      prisma.vaccine.create.mockResolvedValueOnce(
        vaccineRow({ manufacturer: null, vaccineDesc: null }),
      );

      const res = await post({ vaccineName: "Rabies", manufacturer: "", vaccineDesc: "  " });

      expect(res.status).toBe(201);
      expect(prisma.vaccine.create.mock.calls[0][0].data).toEqual({
        vaccineName: "Rabies",
        manufacturer: null,
        vaccineDesc: null,
      });
    });

    test("same name + manufacturer (case-insensitive) → 409, nothing written", async () => {
      prisma.vaccine.findFirst.mockResolvedValueOnce({ vaccineID: 3 });

      const res = await post({ vaccineName: "bird flu 2kzz", manufacturer: "PFIZER" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.vaccine.findFirst.mock.calls[0][0].where).toEqual({
        vaccineName: { equals: "bird flu 2kzz", mode: "insensitive" },
        manufacturer: { equals: "PFIZER", mode: "insensitive" },
      });
      expect(prisma.vaccine.create).not.toHaveBeenCalled();
    });

    test("no manufacturer → the duplicate check only matches another with none", async () => {
      prisma.vaccine.findFirst.mockResolvedValueOnce(null);
      prisma.vaccine.create.mockResolvedValueOnce(vaccineRow({ manufacturer: null }));

      await post({ vaccineName: "Rabies" });

      expect(prisma.vaccine.findFirst.mock.calls[0][0].where.manufacturer).toBeNull();
    });

    test.each([
      ["missing vaccineName", { manufacturer: "Pfizer" }],
      ["blank vaccineName", { vaccineName: "   " }],
      ["vaccineName not a string", { vaccineName: 42 }],
      ["manufacturer not a string", { vaccineName: "Rabies", manufacturer: ["Pfizer"] }],
    ])("%s → 400, nothing read", async (_label, body) => {
      const res = await post(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.vaccine.findFirst).not.toHaveBeenCalled();
    });

    test.each([
      ["vaccineName over 45 chars", { vaccineName: "x".repeat(46) }],
      ["manufacturer over 45 chars", { vaccineName: "Rabies", manufacturer: "x".repeat(46) }],
      ["vaccineDesc over 500 chars", { vaccineName: "Rabies", vaccineDesc: "x".repeat(501) }],
    ])("%s → 422, nothing read", async (_label, body) => {
      const res = await post(body);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(prisma.vaccine.findFirst).not.toHaveBeenCalled();
    });

    test.each(["Staff", "Adopter"])("%s → 403, nothing read", async (role) => {
      const res = await post({ vaccineName: "Rabies" }, signToken(role, 7));

      expect(res.status).toBe(403);
      expect(prisma.vaccine.findFirst).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PUT /vaccines/:id —————————————————————————————
  describe("PUT /api/v1/vaccines/:id", () => {
    const put = (body, id = 3, token = vetToken()) =>
      request(app)
        .put(`/api/v1/vaccines/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    test("description only → 200, only that field written, no duplicate check", async () => {
      prisma.vaccine.findUnique.mockResolvedValueOnce(vaccineRow());
      prisma.vaccine.update.mockResolvedValueOnce(vaccineRow({ vaccineDesc: "For parrots" }));

      const res = await put({ vaccineDesc: "For parrots" });

      expect(res.status).toBe(200);
      expect(prisma.vaccine.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vaccineID: 3 }, data: { vaccineDesc: "For parrots" } }),
      );
      expect(prisma.vaccine.findFirst).not.toHaveBeenCalled();
      expect(res.body.data.vaccineDesc).toBe("For parrots");
    });

    test("null clears manufacturer; duplicate check merges the stored name and skips this vaccine", async () => {
      prisma.vaccine.findUnique.mockResolvedValueOnce(vaccineRow());
      prisma.vaccine.findFirst.mockResolvedValueOnce(null);
      prisma.vaccine.update.mockResolvedValueOnce(vaccineRow({ manufacturer: null }));

      const res = await put({ manufacturer: null });

      expect(res.status).toBe(200);
      expect(prisma.vaccine.update.mock.calls[0][0].data).toEqual({ manufacturer: null });
      expect(prisma.vaccine.findFirst.mock.calls[0][0].where).toEqual({
        vaccineName: { equals: "Bird Flu 2KZZ", mode: "insensitive" },
        manufacturer: null,
        NOT: { vaccineID: 3 },
      });
    });

    test("rename onto another catalog vaccine → 409, nothing written", async () => {
      prisma.vaccine.findUnique.mockResolvedValueOnce(vaccineRow());
      prisma.vaccine.findFirst.mockResolvedValueOnce({ vaccineID: 8 });

      const res = await put({ vaccineName: "Polyomavirus" });

      expect(res.status).toBe(409);
      expect(prisma.vaccine.update).not.toHaveBeenCalled();
    });

    test("unknown vaccine → 404, nothing written", async () => {
      prisma.vaccine.findUnique.mockResolvedValueOnce(null);

      const res = await put({ vaccineDesc: "x" }, 999);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No vaccine exists with ID 999");
      expect(prisma.vaccine.update).not.toHaveBeenCalled();
    });

    test.each([
      ["empty body", {}],
      ["only unknown fields", { vaccineID: 9 }],
      ["blank vaccineName", { vaccineName: "" }],
    ])("%s → 400, nothing read", async (_label, body) => {
      const res = await put(body);

      expect(res.status).toBe(400);
      expect(prisma.vaccine.findUnique).not.toHaveBeenCalled();
    });

    test("non-numeric id → 400, nothing read", async () => {
      const res = await put({ vaccineDesc: "x" }, "abc");

      expect(res.status).toBe(400);
      expect(prisma.vaccine.findUnique).not.toHaveBeenCalled();
    });

    test("Staff → 403, nothing read", async () => {
      const res = await put({ vaccineDesc: "x" }, 3, staffToken());

      expect(res.status).toBe(403);
      expect(prisma.vaccine.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— POST /appointments/:id/vaccinations —————————————————————————————
  describe("POST /api/v1/appointments/:id/vaccinations", () => {
    const yesterday = () => new Date(Date.now() - DAY).toISOString();
    const nextYear = () => new Date(Date.now() + 365 * DAY).toISOString();
    const validBody = () => ({ vaccineID: 2, administeredDate: yesterday(), dueDate: nextYear() });

    const post = (body, id = 11, token = vetToken()) =>
      request(app)
        .post(`/api/v1/appointments/${id}/vaccinations`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    test("assigned vet → 201; petID, administeredBy, administeredAt and appointmentID set server-side", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment());
      prisma.vaccine.findUnique.mockResolvedValueOnce({ vaccineID: 2 });
      prisma.vaccinationRecord.create.mockResolvedValueOnce(doseRow());

      // Body tries to set the server-side fields — all ignored.
      const res = await post({ ...validBody(), petID: 99, administeredBy: 1, administeredAt: 3, appointmentID: 4 });

      expect(res.status).toBe(201);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
        appointmentID: 11,
        vetID: 70,
      });
      expect(prisma.vaccinationRecord.create.mock.calls[0][0].data).toEqual({
        petID: 5,
        vaccineID: 2,
        administeredDate: expect.any(Date),
        dueDate: expect.any(Date),
        administeredBy: 70,
        administeredAt: 1,
        appointmentID: 11,
      });
      expect(res.body.data).toEqual({
        recordID: 9,
        appointmentID: 11,
        vaccineID: 2,
        vaccineName: "Rabies",
        administeredDate: "2026-09-30T10:00:00.000Z",
        dueDate: "2027-09-30T10:00:00.000Z",
        vetName: "Jay Asarathi",
        shelterName: "PetPals Downtown",
      });
    });

    test.each([
      ["omitted", undefined],
      ["null", null],
    ])("dueDate %s → 201, stored as null (no further dose planned)", async (_label, dueDate) => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment());
      prisma.vaccine.findUnique.mockResolvedValueOnce({ vaccineID: 2 });
      prisma.vaccinationRecord.create.mockResolvedValueOnce(doseRow({ dueDate: null }));

      const body = { vaccineID: 2, administeredDate: yesterday() };
      if (dueDate !== undefined) body.dueDate = dueDate;
      const res = await post(body);

      expect(res.status).toBe(201);
      expect(prisma.vaccinationRecord.create.mock.calls[0][0].data.dueDate).toBeNull();
      expect(res.body.data.dueDate).toBeNull();
    });

    test("a Completed appointment still accepts doses", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment({ appointmentStatus: "Completed" }));
      prisma.vaccine.findUnique.mockResolvedValueOnce({ vaccineID: 2 });
      prisma.vaccinationRecord.create.mockResolvedValueOnce(doseRow());

      const res = await post(validBody());

      expect(res.status).toBe(201);
    });

    test("Cancelled appointment → 409, nothing written", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment({ appointmentStatus: "Cancelled" }));

      const res = await post(validBody());

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.vaccinationRecord.create).not.toHaveBeenCalled();
    });

    test("another vet's (or a missing) appointment → 404, nothing written", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);

      const res = await post(validBody(), 99);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No appointment exists with ID 99");
      expect(prisma.vaccinationRecord.create).not.toHaveBeenCalled();
    });

    test("unknown vaccineID → 404, nothing written", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment());
      prisma.vaccine.findUnique.mockResolvedValueOnce(null);

      const res = await post({ ...validBody(), vaccineID: 404 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No vaccine exists with ID 404");
      expect(prisma.vaccinationRecord.create).not.toHaveBeenCalled();
    });

    test.each([
      ["missing vaccineID", { vaccineID: undefined }],
      ["vaccineID not an integer", { vaccineID: "abc" }],
      ["missing administeredDate", { administeredDate: undefined }],
      ["unparseable dueDate", { dueDate: "not-a-date" }],
    ])("%s → 400, nothing read", async (_label, override) => {
      const res = await post({ ...validBody(), ...override });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    test.each([
      [
        "administeredDate in the future",
        () => ({ administeredDate: new Date(Date.now() + DAY).toISOString() }),
        "administeredDate can't be in the future",
      ],
      [
        "dueDate equal to administeredDate",
        () => {
          const d = new Date(Date.now() - DAY).toISOString();
          return { administeredDate: d, dueDate: d };
        },
        "dueDate must be after administeredDate",
      ],
      [
        "dueDate before administeredDate",
        () => ({ dueDate: new Date(Date.now() - 2 * DAY).toISOString() }),
        "dueDate must be after administeredDate",
      ],
    ])("%s → 422, nothing read", async (_label, override, message) => {
      const res = await post({ ...validBody(), ...override() });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toBe(message);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    test.each([
      ["Staff", staffToken],
      ["Admin", adminToken],
    ])("%s → 403, nothing read", async (_role, token) => {
      const res = await post(validBody(), 11, token());

      expect(res.status).toBe(403);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /appointments/:id/vaccinations —————————————————————————————
  describe("GET /api/v1/appointments/:id/vaccinations", () => {
    const list = (token, id = 11) =>
      request(app)
        .get(`/api/v1/appointments/${id}/vaccinations`)
        .set("Authorization", `Bearer ${token}`);

    test("assigned vet → the appointment's doses, oldest first", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment());
      prisma.vaccinationRecord.findMany.mockResolvedValueOnce([doseRow()]);

      const res = await list(vetToken());

      expect(res.status).toBe(200);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
        appointmentID: 11,
        vetID: 70,
      });
      const args = prisma.vaccinationRecord.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ appointmentID: 11 });
      expect(args.orderBy).toEqual({ administeredDate: "asc" });
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ vaccineName: "Rabies", appointmentID: 11 });
    });

    test("another vet's appointment → 404", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);

      const res = await list(vetToken());

      expect(res.status).toBe(404);
      expect(prisma.vaccinationRecord.findMany).not.toHaveBeenCalled();
    });

    test("Staff at the appointment's shelter → 200, not scoped by vetID", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 1 });
      prisma.vaccinationRecord.findMany.mockResolvedValueOnce([]);

      const res = await list(staffToken());

      expect(res.status).toBe(200);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({ appointmentID: 11 });
    });

    test("Staff at another shelter → 403", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 2 });

      const res = await list(staffToken());

      expect(res.status).toBe(403);
      expect(prisma.vaccinationRecord.findMany).not.toHaveBeenCalled();
    });

    test("Admin → any shelter", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointment({ shelterID: 3 }));
      prisma.vaccinationRecord.findMany.mockResolvedValueOnce([]);

      const res = await list(adminToken());

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("unknown appointment → 404", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);

      const res = await list(adminToken(), 999);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    test("Adopter → 403", async () => {
      const res = await list(signToken("Adopter", 7));

      expect(res.status).toBe(403);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });
  });
});
