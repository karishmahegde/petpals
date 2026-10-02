const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  veterinarian: { findUnique: jest.fn() },
  vaccinationRecord: { findMany: jest.fn() },
  appointment: { findMany: jest.fn() },
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

const signToken = (role, userID = 70) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

// A dose row as listOverdueVaccinations selects it.
const dose = (petID, vaccineID, administeredDaysAgo, dueDaysAgo, extra = {}) => ({
  petID,
  vaccineID,
  administeredDate: daysAgo(administeredDaysAgo),
  dueDate: daysAgo(dueDaysAgo),
  vaccine: { vaccineName: vaccineID === 1 ? "FVRCP" : "Rabies" },
  pet: { petName: petID === 5 ? "Whiskers" : "Rex", petPhoto: null },
  ...extra,
});

describe("Vet Overview endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/vets/me/vaccinations/overdue", () => {
    const get = (token = signToken("Veterinarian")) =>
      request(app)
        .get("/api/v1/vets/me/vaccinations/overdue")
        .set("Authorization", `Bearer ${token}`);

    test("only the latest dose per pet + vaccine counts; most overdue first, with the dose now due", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      // Ascending by administeredDate, as the service orders them.
      prisma.vaccinationRecord.findMany.mockResolvedValueOnce([
        // Whiskers FVRCP dose 1, overdue 13 days, never boosted → overdue (dose 2 due).
        dose(5, 1, 400, 13),
        // Rex Rabies dose 1 overdue, but a later dose 2 isn't due yet → not overdue.
        dose(6, 2, 800, 400),
        dose(6, 2, 30, -335),
        // Rex FVRCP: two doses, latest overdue by 40 days → overdue (dose 3 due).
        dose(6, 1, 500, 300),
        dose(6, 1, 100, 40),
        // Whiskers Rabies: an overdue dose, then a later one with no further
        // dose planned (dueDate null) → never overdue.
        dose(5, 2, 900, 500),
        dose(5, 2, 60, 0, { dueDate: null }),
      ]);

      const res = await get();

      expect(res.status).toBe(200);
      expect(prisma.vaccinationRecord.findMany.mock.calls[0][0].where).toEqual({
        pet: { shelterID: 9, adoptionStatus: { notIn: ["adopted", "deceased"] } },
      });
      expect(res.body.data).toEqual([
        expect.objectContaining({ petName: "Rex", vaccineName: "FVRCP", doseNumber: 3, daysOverdue: 40 }),
        expect.objectContaining({ petName: "Whiskers", vaccineName: "FVRCP", doseNumber: 2, daysOverdue: 13 }),
      ]);
    });

    test("vet with no shelter → empty list, nothing else read", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(prisma.vaccinationRecord.findMany).not.toHaveBeenCalled();
    });

    test("Staff role → 403", async () => {
      const res = await get(signToken("Staff", 42));

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/vets/me/stats", () => {
    test("petsTreated = distinct pets at the vet's past, non-cancelled appointments", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([{ petID: 5 }, { petID: 6 }, { petID: 9 }]);

      const res = await request(app)
        .get("/api/v1/vets/me/stats")
        .set("Authorization", `Bearer ${signToken("Veterinarian")}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ petsTreated: 3 });
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        vetID: 70,
        appointmentStatus: { not: "Cancelled" },
        appointmentDate: { lte: expect.any(Date) },
      });
      expect(args.distinct).toEqual(["petID"]);
    });

    test("a Pending vet → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await request(app)
        .get("/api/v1/vets/me/stats")
        .set("Authorization", `Bearer ${signToken("Veterinarian")}`);

      expect(res.status).toBe(401);
    });
  });
});
