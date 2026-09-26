const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn(), findMany: jest.fn() },
  shelter: { findUnique: jest.fn() },
  pet: { findUnique: jest.fn() },
  veterinarian: { findUnique: jest.fn(), findMany: jest.fn() },
  volunteer: { findUnique: jest.fn(), findMany: jest.fn() },
  appointment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  adoptionApplication: { findFirst: jest.fn() },
}));

jest.mock("../../../services/storage", () => ({
  PET_IMAGES_BUCKET: "pet-images",
  toPublicFileUrl: jest.fn((bucket, value) =>
    value ? `https://cdn.test/${bucket}/${value}` : value,
  ),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = () => signToken("Staff", 42);
const adminToken = () => signToken("Admin", 1);
const adopterToken = () => signToken("Adopter", 7);

const SHELTER = 9;
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const PET = {
  petID: 5,
  petName: "Rex",
  petPhoto: "pets/5/photo.jpg",
  breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
};

// What getShelterAppointmentDetail reads — every create/update/cancel ends
// by returning it.
const buildDetailRow = (overrides = {}) => ({
  appointmentID: 20,
  appointmentCode: "APT-00020",
  appointmentDate: inDays(3),
  appointmentReason: "Annual checkup",
  appointmentStatus: "Scheduled",
  shelterID: SHELTER,
  vetID: 70,
  staffID: 42,
  volunteerID: null,
  pet: PET,
  vet: { vetName: "Adrian Nicholes" },
  shelter: { shelterName: "Athens Shelter" },
  staff: { staffName: "Sasha Grey" },
  volunteer: null,
  vaccinations: [],
  ...overrides,
});

// The detail read: the row (vaccines linked to it included), the caller's
// shelter check (Staff), and the pet's accepted application.
const mockDetailRead = (row = buildDetailRow()) => {
  prisma.appointment.findUnique.mockResolvedValueOnce(row);
  prisma.adoptionApplication.findFirst.mockResolvedValueOnce(null);
};

const VALID_CREATE_BODY = {
  petID: 5,
  vetID: 70,
  appointmentDate: inDays(3).toISOString(),
  appointmentReason: "Annual checkup",
};

describe("Appointments (Staff/Admin)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
    // Unless a test says otherwise, the caller is Staff at SHELTER.
    prisma.staff.findUnique.mockResolvedValue({ shelterID: SHELTER });
  });

  // ————————————————————————————— POST /appointments —————————————————————————————
  describe("POST /api/v1/appointments", () => {
    test("Staff: created at their shelter; staffID defaults to the acting staff member", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: SHELTER });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.appointment.create.mockResolvedValueOnce({ appointmentID: 20 });
      mockDetailRead();

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(201);
      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            petID: 5,
            vetID: 70,
            shelterID: SHELTER,
            staffID: 42,
            volunteerID: null,
            appointmentReason: "Annual checkup",
          }),
        }),
      );
      expect(res.body.data).toMatchObject({
        appointmentID: 20,
        status: "Scheduled",
        vetName: "Adrian Nicholes",
        pet: { petName: "Rex", breedName: "Beagle" },
      });
    });

    test("explicit staffID + volunteerID at the shelter are used", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: SHELTER });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: SHELTER });
      prisma.staff.findUnique
        .mockResolvedValueOnce({ shelterID: SHELTER }) // the caller
        .mockResolvedValueOnce({ shelterID: SHELTER, accountStatus: "Active" }); // staff 43
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.appointment.create.mockResolvedValueOnce({ appointmentID: 20 });
      mockDetailRead();

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ ...VALID_CREATE_BODY, staffID: 43, volunteerID: 90 });

      expect(res.status).toBe(201);
      expect(prisma.appointment.create.mock.calls[0][0].data).toMatchObject({
        staffID: 43,
        volunteerID: 90,
      });
    });

    test("same pet + vet + time already Scheduled → 409 CONFLICT, nothing written", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: SHELTER });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      prisma.appointment.findFirst.mockResolvedValueOnce({ appointmentID: 19 });

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toMatchObject({
        petID: 5,
        vetID: 70,
        appointmentStatus: "Scheduled",
      });
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    test("a race past the pre-check (unique-index violation) → 409 CONFLICT", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: SHELTER });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.appointment.create.mockRejectedValueOnce(
        Object.assign(new Error("duplicate"), { code: "P2002" }),
      );

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
    });

    test("pet at another shelter → 400 BAD_REQUEST, nothing written", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: 3 });

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    test("pet not found → 404 NOT_FOUND", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(404);
    });

    test.each([
      ["at another shelter", { shelterID: 3, accountStatus: "Active" }],
      ["not Active", { shelterID: SHELTER, accountStatus: "Pending" }],
      ["nonexistent", null],
    ])("vet %s → 400 BAD_REQUEST, nothing written", async (_label, vet) => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: SHELTER });
      prisma.veterinarian.findUnique.mockResolvedValueOnce(vet);

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    test("assigned staff member not Active at the shelter → 400 BAD_REQUEST", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ petID: 5, shelterID: SHELTER });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      prisma.staff.findUnique
        .mockResolvedValueOnce({ shelterID: SHELTER }) // the caller
        .mockResolvedValueOnce({ shelterID: SHELTER, accountStatus: "Deactivated" });

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ ...VALID_CREATE_BODY, staffID: 43 });

      expect(res.status).toBe(400);
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    test("Staff with no shelter assigned → 409 CONFLICT", async () => {
      prisma.staff.findUnique.mockReset();
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("Admin: shelterID required", async () => {
      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test.each([
      ["appointmentDate in the past", { ...VALID_CREATE_BODY, appointmentDate: inDays(-1).toISOString() }],
      ["invalid appointmentDate", { ...VALID_CREATE_BODY, appointmentDate: "not-a-date" }],
      ["blank appointmentReason", { ...VALID_CREATE_BODY, appointmentReason: "  " }],
      ["appointmentReason over 300 chars", { ...VALID_CREATE_BODY, appointmentReason: "x".repeat(301) }],
      ["missing vetID", { petID: 5, appointmentDate: inDays(3).toISOString(), appointmentReason: "x" }],
    ])("%s → 400 BAD_REQUEST, nothing queried", async (_label, body) => {
      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("Adopter → 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/appointments")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(403);
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /appointments —————————————————————————————
  describe("GET /api/v1/appointments", () => {
    test("upcoming=true → Scheduled + future only, at the caller's shelter, soonest first", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([buildDetailRow()]);
      prisma.appointment.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/appointments")
        .query({ upcoming: "true", vetID: 70, petName: "rex" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        shelterID: SHELTER,
        appointmentStatus: "Scheduled",
        vetID: 70,
        pet: { petName: { contains: "rex", mode: "insensitive" } },
      });
      expect(args.where.appointmentDate.gt).toBeInstanceOf(Date);
      expect(args.orderBy).toEqual({ appointmentDate: "asc" });
    });

    test("past list: a Scheduled appointment whose date has passed reads as Completed", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([
        buildDetailRow({ appointmentDate: inDays(-2) }),
        buildDetailRow({ appointmentID: 21, appointmentStatus: "Cancelled" }),
      ]);
      prisma.appointment.count.mockResolvedValueOnce(2);

      const res = await request(app)
        .get("/api/v1/appointments")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((a) => a.status)).toEqual(["Completed", "Cancelled"]);
      expect(prisma.appointment.findMany.mock.calls[0][0].orderBy).toEqual({
        appointmentDate: "desc",
      });
    });

    test("Admin: no shelterID → unscoped", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([]);
      prisma.appointment.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/appointments")
        .query({ upcoming: "true" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.appointment.findMany.mock.calls[0][0].where.shelterID).toBeUndefined();
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("invalid vetID → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/appointments")
        .query({ vetID: "abc" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
    });
  });

  // ————————————————————————————— GET /appointments/:id —————————————————————————————
  describe("GET /api/v1/appointments/:id", () => {
    test("returns the detail, incl. the adopter of a pet with an Accepted application", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce(
        buildDetailRow({
          vaccinations: [
            { recordID: 1, dueDate: inDays(365), vaccine: { vaccineName: "Rabies" } },
          ],
        }),
      );
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce({
        adopter: {
          adopterName: "Emelie Archer",
          adopterPhone: "+12125550105",
          addressLine1: "1 Main St",
          addressLine2: null,
          city: "Athens",
          state: "GA",
          zip: "30601",
          country: "United States",
          user: { userEmail: "adopter@petpals.com" },
        },
      });

      const res = await request(app)
        .get("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      // Vaccines come from the appointment's own linked records (no
      // calendar-day window, so no dependence on the server's timezone).
      expect(prisma.appointment.findUnique.mock.calls[0][0].select.vaccinations).toEqual({
        select: {
          recordID: true,
          dueDate: true,
          vaccine: { select: { vaccineName: true } },
        },
        orderBy: { administeredDate: "asc" },
      });
      expect(res.body.data).toMatchObject({
        appointmentCode: "APT-00020",
        vaccinesAdministered: [{ vaccineName: "Rabies" }],
        adopter: {
          adopterName: "Emelie Archer",
          adopterEmail: "adopter@petpals.com",
          address: "1 Main St, Athens, GA, 30601, United States",
        },
      });
    });

    test("another shelter's appointment → 403 FORBIDDEN", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce(buildDetailRow({ shelterID: 3 }));

      const res = await request(app)
        .get("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });

    test("not found → 404 NOT_FOUND", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/appointments/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————————————— PATCH /appointments/:id —————————————————————————————
  describe("PATCH /api/v1/appointments/:id", () => {
    const existing = (overrides = {}) => ({
      petID: 5,
      vetID: 70,
      shelterID: SHELTER,
      appointmentDate: inDays(3),
      appointmentStatus: "Scheduled",
      ...overrides,
    });

    test("reschedule + reassign vet; the duplicate check excludes this appointment", async () => {
      const newDate = inDays(5);
      prisma.appointment.findUnique.mockResolvedValueOnce(existing());
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.appointment.update.mockResolvedValueOnce({});
      mockDetailRead(buildDetailRow({ vetID: 71, appointmentDate: newDate }));

      const res = await request(app)
        .patch("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ vetID: 71, appointmentDate: newDate.toISOString() });

      expect(res.status).toBe(200);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toMatchObject({
        petID: 5,
        vetID: 71,
        NOT: { appointmentID: 20 },
      });
      expect(prisma.appointment.update.mock.calls[0][0].data).toMatchObject({ vetID: 71 });
    });

    test("volunteerID: null unassigns", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce(existing());
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.appointment.update.mockResolvedValueOnce({});
      mockDetailRead();

      const res = await request(app)
        .patch("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ volunteerID: null });

      expect(res.status).toBe(200);
      expect(prisma.appointment.update.mock.calls[0][0].data).toEqual({ volunteerID: null });
    });

    test.each([
      ["Cancelled", existing({ appointmentStatus: "Cancelled" })],
      ["already past (reads as Completed)", existing({ appointmentDate: inDays(-1) })],
    ])("%s → 409 CONFLICT, nothing written", async (_label, row) => {
      prisma.appointment.findUnique.mockResolvedValueOnce(row);

      const res = await request(app)
        .patch("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ appointmentReason: "Follow-up" });

      expect(res.status).toBe(409);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    test("another shelter's appointment → 403 FORBIDDEN, nothing written", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce(existing({ shelterID: 3 }));

      const res = await request(app)
        .patch("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ appointmentReason: "Follow-up" });

      expect(res.status).toBe(403);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    test.each([["petID"], ["shelterID"], ["appointmentStatus"]])(
      "locked field %s → 400 BAD_REQUEST",
      async (field) => {
        const res = await request(app)
          .patch("/api/v1/appointments/20")
          .set("Authorization", `Bearer ${staffToken()}`)
          .send({ [field]: 1 });

        expect(res.status).toBe(400);
        expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
      },
    );

    test("appointmentDate in the past → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .patch("/api/v1/appointments/20")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ appointmentDate: inDays(-1).toISOString() });

      expect(res.status).toBe(400);
      expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /appointments/:id/cancel —————————————————————————————
  describe("PATCH /api/v1/appointments/:id/cancel", () => {
    test("upcoming Scheduled → Cancelled", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce({
        shelterID: SHELTER,
        appointmentStatus: "Scheduled",
        appointmentDate: inDays(3),
      });
      prisma.appointment.update.mockResolvedValueOnce({});
      mockDetailRead(buildDetailRow({ appointmentStatus: "Cancelled" }));

      const res = await request(app)
        .patch("/api/v1/appointments/20/cancel")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("Cancelled");
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { appointmentID: 20 },
        data: { appointmentStatus: "Cancelled" },
      });
    });

    test.each([
      ["already Cancelled", { appointmentStatus: "Cancelled", appointmentDate: inDays(3) }],
      ["in the past", { appointmentStatus: "Scheduled", appointmentDate: inDays(-1) }],
    ])("%s → 409 CONFLICT, nothing written", async (_label, row) => {
      prisma.appointment.findUnique.mockResolvedValueOnce({ shelterID: SHELTER, ...row });

      const res = await request(app)
        .patch("/api/v1/appointments/20/cancel")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(409);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    test("another shelter's appointment → 403 FORBIDDEN", async () => {
      prisma.appointment.findUnique.mockResolvedValueOnce({
        shelterID: 3,
        appointmentStatus: "Scheduled",
        appointmentDate: inDays(3),
      });

      const res = await request(app)
        .patch("/api/v1/appointments/20/cancel")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— rosters —————————————————————————————
  describe("GET /api/v1/appointments/vets|volunteers|staff", () => {
    test.each([
      ["vets", "veterinarian", { userID: 70, vetName: "Adrian Nicholes" }, { vetID: 70, vetName: "Adrian Nicholes" }],
      ["volunteers", "volunteer", { userID: 90, volunteerName: "Ariana Delwon" }, { volunteerID: 90, volunteerName: "Ariana Delwon" }],
      ["staff", "staff", { userID: 43, staffName: "Jo Park" }, { staffID: 43, staffName: "Jo Park" }],
    ])("/%s: Active people at the caller's shelter only", async (path, model, row, expected) => {
      prisma[model].findMany.mockResolvedValueOnce([row]);

      const res = await request(app)
        .get(`/api/v1/appointments/${path}`)
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma[model].findMany.mock.calls[0][0].where).toEqual({
        shelterID: SHELTER,
        accountStatus: "Active",
      });
      expect(res.body.data).toEqual([expected]);
    });

    test("Admin without shelterID → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/appointments/vets")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.veterinarian.findMany).not.toHaveBeenCalled();
    });

    test("Admin with shelterID → that shelter's roster", async () => {
      prisma.veterinarian.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/appointments/vets")
        .query({ shelterID: 3 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.findMany.mock.calls[0][0].where.shelterID).toBe(3);
    });
  });
});
