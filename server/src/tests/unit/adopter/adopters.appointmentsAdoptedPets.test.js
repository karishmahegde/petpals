const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  appointment: { findMany: jest.fn(), findFirst: jest.fn() },
  vaccinationRecord: { findMany: jest.fn() },
  adoptionApplication: { findFirst: jest.fn() },
  pet: { findUnique: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 7) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adopterToken = () => signToken("Adopter", 7);
const staffToken = () => signToken("Staff", 42);

// The access rule shared by both appointment endpoints.
const ACCEPTED_FOR_ADOPTER_7 = {
  adoptionApps: { some: { adopterID: 7, applicationStatus: "Accepted" } },
};

// A DOB `years`/`months` before today, on the 1st so the day-of-month
// adjustment in formatAgeLong never kicks in.
const dobAgo = (years, months) => {
  const today = new Date();
  return new Date(today.getFullYear() - years, today.getMonth() - months, 1);
};

describe("Adopter appointments + adopted-pet detail", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————— GET /adopters/me/appointments —————————————————————
  describe("GET /api/v1/adopters/me/appointments", () => {
    test("only pets the adopter has an Accepted application for, date-ascending", async () => {
      const rows = [
        {
          appointmentID: 1,
          appointmentDate: new Date("2026-10-01T10:00:00Z"),
          appointmentReason: "Checkup",
          pet: { petID: 12, petName: "Biscuit" },
          shelter: { shelterName: "Downtown Shelter" },
          vet: { vetName: "Dr. Vee" },
        },
      ];
      prisma.appointment.findMany.mockResolvedValueOnce(rows);

      const res = await request(app)
        .get("/api/v1/adopters/me/appointments")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ pet: ACCEPTED_FOR_ADOPTER_7 });
      expect(args.orderBy).toEqual({ appointmentDate: "asc" });
      expect(res.body.data).toEqual([
        { ...rows[0], appointmentDate: "2026-10-01T10:00:00.000Z" },
      ]);
    });

    test("upcoming=true -> also appointmentDate > now", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([]);
      const before = Date.now();

      await request(app)
        .get("/api/v1/adopters/me/appointments")
        .query({ upcoming: "true" })
        .set("Authorization", `Bearer ${adopterToken()}`);

      const { where } = prisma.appointment.findMany.mock.calls[0][0];
      expect(where.pet).toEqual(ACCEPTED_FOR_ADOPTER_7);
      expect(where.appointmentDate.gt).toBeInstanceOf(Date);
      expect(where.appointmentDate.gt.getTime()).toBeGreaterThanOrEqual(before);
    });

    test.each(["false", "1", "TRUE", "yes"])(
      "upcoming=%s -> no date filter (only the exact string 'true' enables it)",
      async (upcoming) => {
        prisma.appointment.findMany.mockResolvedValueOnce([]);

        await request(app)
          .get("/api/v1/adopters/me/appointments")
          .query({ upcoming })
          .set("Authorization", `Bearer ${adopterToken()}`);

        expect(prisma.appointment.findMany.mock.calls[0][0].where).not.toHaveProperty(
          "appointmentDate",
        );
      },
    );

    test("no adopted pets -> empty array, not an error", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/adopters/me/appointments")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test("Staff -> 403", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me/appointments")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });

    test("no token -> 401", async () => {
      const res = await request(app).get("/api/v1/adopters/me/appointments");

      expect(res.status).toBe(401);
    });
  });

  // ————————————————————— GET /adopters/me/appointments/:id —————————————————————
  describe("GET /api/v1/adopters/me/appointments/:id", () => {
    const appointmentRow = (overrides = {}) => ({
      appointmentID: 5,
      appointmentCode: "APT-00005",
      appointmentDate: new Date("2026-10-01T14:30:00"),
      appointmentReason: "Vaccination",
      pet: {
        petID: 12,
        petName: "Biscuit",
        petPhoto: "biscuit.jpg",
        breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
      },
      vet: { vetName: "Dr. Vee" },
      shelter: { shelterName: "Downtown Shelter", shelterAddress: "1 Main St" },
      vaccinations: [],
      ...overrides,
    });

    test("found -> flattened detail with the vaccines linked to this appointment", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(
        appointmentRow({
          vaccinations: [
            { recordID: 3, dueDate: new Date("2027-10-01"), vaccine: { vaccineName: "Rabies" } },
          ],
        }),
      );

      const res = await request(app)
        .get("/api/v1/adopters/me/appointments/5")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
        appointmentID: 5,
        pet: ACCEPTED_FOR_ADOPTER_7,
      });
      expect(res.body.data).toEqual({
        appointmentID: 5,
        appointmentCode: "APT-00005",
        appointmentDate: new Date("2026-10-01T14:30:00").toISOString(),
        appointmentReason: "Vaccination",
        pet: {
          petID: 12,
          petName: "Biscuit",
          petPhoto: "biscuit.jpg",
          breedName: "Beagle",
          speciesName: "Dog",
        },
        vetName: "Dr. Vee",
        shelterName: "Downtown Shelter",
        shelterAddress: "1 Main St",
        vaccinesAdministered: [
          { recordID: 3, vaccineName: "Rabies", dueDate: "2027-10-01T00:00:00.000Z" },
        ],
      });
    });

    test("vaccines come from the appointment's own linked records, oldest dose first (no day window)", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointmentRow());

      await request(app)
        .get("/api/v1/adopters/me/appointments/5")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(prisma.appointment.findFirst.mock.calls[0][0].select.vaccinations).toEqual({
        select: {
          recordID: true,
          dueDate: true,
          vaccine: { select: { vaccineName: true } },
        },
        orderBy: { administeredDate: "asc" },
      });
      // A separate date-windowed lookup would reintroduce the timezone bug.
      expect(prisma.vaccinationRecord.findMany).not.toHaveBeenCalled();
    });

    test("no linked vaccines -> empty list", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointmentRow());

      const res = await request(app)
        .get("/api/v1/adopters/me/appointments/5")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.body.data.vaccinesAdministered).toEqual([]);
    });

    test("no vet assigned -> vetName null", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(appointmentRow({ vet: null }));

      const res = await request(app)
        .get("/api/v1/adopters/me/appointments/5")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.body.data.vetName).toBeNull();
    });

    test("not found OR not for a pet this adopter adopted -> 404 (existence not leaked)", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/adopters/me/appointments/5")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(404);
    });

    test.each(["abc", "0", "-1", "1.5"])("id %s -> 400", async (id) => {
      const res = await request(app)
        .get(`/api/v1/adopters/me/appointments/${id}`)
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    test("Staff -> 403", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me/appointments/5")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });
  });

  // ————————————————————— GET /adopters/me/adopted-pets/:petId —————————————————————
  describe("GET /api/v1/adopters/me/adopted-pets/:petId", () => {
    const acceptedApp = {
      createdAt: new Date("2026-06-15T09:00:00Z"),
      shelterMessage: "We'd love to adopt Biscuit!",
      staffRemark: "Great fit",
      shelter: { shelterName: "Downtown Shelter", shelterAddress: "1 Main St" },
    };

    const petRow = (overrides = {}) => ({
      petID: 12,
      petCode: "PET-00012",
      petName: "Biscuit",
      petPhoto: "biscuit.jpg",
      petDOB: dobAgo(2, 3),
      petSex: "M",
      petColor: "Tan",
      petSize: "Medium",
      petHeight: 40,
      petWeight: 12,
      petBGroup: "DEA 1.1+",
      petDesc: "Friendly",
      microchipID: "985112345678901",
      adoptionStatus: "adopted",
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: null,
      breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
      ...overrides,
    });

    const mockDetail = ({ pet = petRow(), vaccinations = [], appointments = [] } = {}) => {
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce(acceptedApp);
      prisma.pet.findUnique.mockResolvedValueOnce(pet);
      prisma.vaccinationRecord.findMany.mockResolvedValueOnce(vaccinations);
      prisma.appointment.findMany.mockResolvedValueOnce(appointments);
    };

    const get = (petId = 12) =>
      request(app)
        .get(`/api/v1/adopters/me/adopted-pets/${petId}`)
        .set("Authorization", `Bearer ${adopterToken()}`);

    test("full consolidated payload: details, compatibility, health, adoption record", async () => {
      mockDetail({
        vaccinations: [
          {
            recordID: 3,
            administeredDate: new Date("2026-07-01"),
            dueDate: new Date("2027-07-01"),
            vaccine: { vaccineName: "Rabies" },
            vet: { vetName: "Dr. Vee" },
          },
          {
            recordID: 2,
            administeredDate: new Date("2026-05-01"),
            dueDate: null,
            vaccine: { vaccineName: "DHPP" },
            vet: null,
          },
        ],
        appointments: [
          {
            appointmentID: 9,
            appointmentDate: new Date("2026-11-01T10:00:00Z"),
            appointmentReason: "Booster",
            vet: null,
            shelter: { shelterName: "Downtown Shelter" },
          },
        ],
      });

      const res = await get();

      expect(res.status).toBe(200);
      expect(prisma.adoptionApplication.findFirst.mock.calls[0][0].where).toEqual({
        adopterID: 7,
        petID: 12,
        applicationStatus: "Accepted",
      });
      expect(res.body.data).toMatchObject({
        petID: 12,
        petName: "Biscuit",
        petAge: "2 years, 3 months",
        petSex: "Male",
        breed: { breedName: "Beagle", speciesName: "Dog" },
        compatibility: { children: true, otherPets: false, specialNeeds: null },
        health: {
          vaccinations: [
            { recordID: 3, vaccineName: "Rabies", vetName: "Dr. Vee" },
            { recordID: 2, vaccineName: "DHPP", vetName: null, dueDate: null },
          ],
          appointments: [
            {
              appointmentID: 9,
              appointmentReason: "Booster",
              vetName: null,
              shelterName: "Downtown Shelter",
            },
          ],
        },
        adoption: {
          adoptedOn: "2026-06-15T09:00:00.000Z",
          shelterName: "Downtown Shelter",
          shelterAddress: "1 Main St",
          yourMessage: "We'd love to adopt Biscuit!",
          staffRemark: "Great fit",
        },
      });
      // Raw relation / column names never leak into the response.
      expect(res.body.data).not.toHaveProperty("compatibleWithChildren");
      expect(res.body.data.breed).not.toHaveProperty("species");
    });

    test("health panel: vaccinations newest-first, only upcoming appointments soonest-first", async () => {
      mockDetail();
      const before = Date.now();

      await get();

      const vacArgs = prisma.vaccinationRecord.findMany.mock.calls[0][0];
      expect(vacArgs.where).toEqual({ petID: 12 });
      expect(vacArgs.orderBy).toEqual({ administeredDate: "desc" });

      const aptArgs = prisma.appointment.findMany.mock.calls[0][0];
      expect(aptArgs.where.petID).toBe(12);
      expect(aptArgs.where.appointmentDate.gt.getTime()).toBeGreaterThanOrEqual(before);
      expect(aptArgs.orderBy).toEqual({ appointmentDate: "asc" });
    });

    test.each([
      [0, 0, "0 months"],
      [0, 1, "1 month"],
      [0, 5, "5 months"],
      [1, 0, "1 year"],
      [3, 0, "3 years"],
      [1, 1, "1 year, 1 month"],
      [4, 11, "4 years, 11 months"],
    ])("age %iy %im -> %s", async (years, months, expected) => {
      mockDetail({ pet: petRow({ petDOB: dobAgo(years, months) }) });

      const res = await get();

      expect(res.body.data.petAge).toBe(expected);
    });

    test("birthday later this month -> not a full month yet", async () => {
      const today = new Date();
      // Only meaningful when there's a later day in this month to use.
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      if (today.getDate() === lastDay) return;
      mockDetail({
        pet: petRow({
          petDOB: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1),
        }),
      });

      const res = await get();

      expect(res.body.data.petAge).toBe("11 months");
    });

    test.each([
      ["M", "Male"],
      ["F", "Female"],
      ["U", "Unknown"],
      [null, "Unknown"],
    ])("petSex %p -> %s", async (petSex, expected) => {
      mockDetail({ pet: petRow({ petSex }) });

      const res = await get();

      expect(res.body.data.petSex).toBe(expected);
    });

    test("no Accepted application (pending, withdrawn, someone else's pet) -> 403, pet never read", async () => {
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce(null);

      const res = await get();

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("You can only view details for pets you have adopted");
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
      expect(prisma.vaccinationRecord.findMany).not.toHaveBeenCalled();
    });

    test("Accepted application but the pet row is gone -> 404", async () => {
      mockDetail({ pet: null });

      const res = await get();

      expect(res.status).toBe(404);
    });

    test.each(["abc", "0", "-4"])("petId %s -> 400", async (petId) => {
      const res = await get(petId);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("petId must be a positive integer");
      expect(prisma.adoptionApplication.findFirst).not.toHaveBeenCalled();
    });

    test("Staff -> 403", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me/adopted-pets/12")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });
  });
});
