const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  veterinarian: { findUnique: jest.fn() },
  staff: { findUnique: jest.fn() },
  pet: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  adoptionApplication: { findFirst: jest.fn() },
  healthRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  vaccinationRecord: { findMany: jest.fn() },
  transferHistory: { findMany: jest.fn() },
}));

// toPublicFileUrl keeps a pure stand-in so response shapes stay realistic.
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

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const vetToken = () => signToken("Veterinarian", 70);

// Matches STAFF_PET_DETAIL_SELECT in staff/pets.service.js. Pet 10 at
// shelter 9.
const petRow = (overrides = {}) => ({
  petID: 10,
  petCode: "PE000010",
  petName: "Rex",
  petDOB: new Date(2021, 0, 1),
  petSex: "M",
  petColor: "Brown",
  petPhoto: "rex.jpg",
  petHeight: 40,
  petWeight: 12.5,
  petDesc: null,
  petSize: "Medium",
  petBGroup: "DEA1",
  microchipID: "985141000000010",
  intakeDate: new Date(2024, 5, 1),
  intakeType: "transferred",
  featuredFlag: false,
  adoptionStatus: "available",
  shelterID: 9,
  breed: { breedID: 3, breedName: "Beagle", species: { speciesName: "Dog" } },
  shelter: { shelterID: 9, shelterName: "Athens Shelter", shelterAddress: "1 Main St" },
  compatibleWithChildren: false,
  compatibleWithPets: false,
  specialNeeds: false,
  ...overrides,
});

// Matches RECORD_SELECT in vet/healthRecords.service.js.
const recordRow = (overrides = {}) => ({
  recordID: 5,
  petID: 10,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  lastUpdated: new Date("2026-10-01T09:00:00Z"),
  recordDesc: "Ear infection, drops prescribed.",
  appointment: null,
  vet: { vetName: "Jay Asarathi", shelter: { shelterName: "Athens Shelter" } },
  ...overrides,
});

const vetAtShelter = (shelterID) =>
  prisma.veterinarian.findUnique.mockResolvedValueOnce({ shelterID });

describe("Vet pets, health passport and health records", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /vets/me/pets —————————————————————————————
  describe("GET /api/v1/vets/me/pets", () => {
    const list = (query = {}) =>
      request(app)
        .get("/api/v1/vets/me/pets")
        .query(query)
        .set("Authorization", `Bearer ${vetToken()}`);

    test("scoped to the vet's shelter, with the Staff filters plus petName", async () => {
      vetAtShelter(9);
      prisma.pet.findMany.mockResolvedValueOnce([]);
      prisma.pet.count.mockResolvedValueOnce(0);

      const res = await list({
        petName: " re ",
        adoptionStatus: "available",
        species: "1",
        size: "Medium",
        sort: "newest",
        page: "2",
        limit: "5",
      });

      expect(res.status).toBe(200);
      const args = prisma.pet.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        shelterID: 9,
        adoptionStatus: "available",
        petName: { contains: "re", mode: "insensitive" },
        breed: { species: { speciesID: expect.anything() } },
        petSize: expect.anything(),
      });
      expect(args.orderBy).toEqual({ intakeDate: "desc" });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
      expect(res.body.pagination).toEqual({ page: 2, limit: 5, total: 0, totalPages: 0 });
    });

    test("same list-item shape as /staff/me/pets", async () => {
      vetAtShelter(9);
      prisma.pet.findMany.mockResolvedValueOnce([
        {
          petID: 10,
          petName: "Rex",
          petDOB: new Date(2021, 0, 1),
          petPhoto: "rex.jpg",
          petSex: "M",
          adoptionStatus: "available",
          intakeDate: new Date(2024, 5, 1),
          breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
        },
      ]);
      prisma.pet.count.mockResolvedValueOnce(1);

      const res = await list();

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ["petID", "petName", "petAge", "petSex", "petPhoto", "adoptionStatus", "intakeDate", "breed"].sort(),
      );
    });

    test("vet with no shelter → empty list, not an error", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce({ shelterID: null });
      prisma.pet.findMany.mockResolvedValueOnce([]);
      prisma.pet.count.mockResolvedValueOnce(0);

      const res = await list();

      expect(res.status).toBe(200);
      expect(prisma.pet.findMany.mock.calls[0][0].where.shelterID).toBe(-1);
    });

    test.each([
      ["adoptionStatus=lost", { adoptionStatus: "lost" }],
      ["sort=oldest", { sort: "oldest" }],
      ["species=dog", { species: "dog" }],
    ])("%s → 400, nothing queried", async (_label, query) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });

    test("Staff role → 403", async () => {
      const res = await request(app)
        .get("/api/v1/vets/me/pets")
        .set("Authorization", `Bearer ${signToken("Staff", 42)}`);

      expect(res.status).toBe(403);
    });
  });

  // ————————————————————————————— GET /vets/me/pets/:id —————————————————————————————
  describe("GET /api/v1/vets/me/pets/:id", () => {
    const get = (id = 10) =>
      request(app)
        .get(`/api/v1/vets/me/pets/${id}`)
        .set("Authorization", `Bearer ${vetToken()}`);

    test("pet at the vet's shelter → same detail shape as Staff's", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(petRow());
      vetAtShelter(9);

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        petID: 10,
        petCode: "PE000010",
        microchipID: "985141000000010",
        intakeType: "transferred",
        adopter: null,
      });
    });

    test("pet at another shelter → 404, like a missing one", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(petRow({ shelterID: 3 }));
      vetAtShelter(9);

      const res = await get();

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No pet exists with ID 10");
    });
  });

  // ————————————————————————————— GET /vets/me/pets/:id/health-passport —————————————————————————————
  describe("GET /api/v1/vets/me/pets/:id/health-passport", () => {
    const getPassport = (id = 10) =>
      request(app)
        .get(`/api/v1/vets/me/pets/${id}/health-passport`)
        .set("Authorization", `Bearer ${vetToken()}`);

    test("universal: records, doses and transfers read by petID only — history from a previous shelter included", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(petRow());
      vetAtShelter(9);
      prisma.healthRecord.findMany.mockResolvedValueOnce([
        {
          recordID: 1,
          createdAt: new Date("2025-03-01T10:00:00Z"),
          recordDesc: "Intake exam at Brooklyn.",
          appointment: null,
          vet: { vetName: "Amara Okafor", shelter: { shelterName: "Brooklyn Shelter" } },
        },
      ]);
      prisma.vaccinationRecord.findMany.mockResolvedValueOnce([
        {
          recordID: 4,
          administeredDate: new Date("2025-03-02T10:00:00Z"),
          dueDate: new Date(Date.now() + 200 * 86400000),
          vaccine: { vaccineName: "Rabies" },
        },
      ]);
      prisma.transferHistory.findMany.mockResolvedValueOnce([
        {
          recordID: 2,
          transferDate: new Date("2025-06-01T00:00:00Z"),
          transferReason: "Capacity",
          transferStatus: "Completed",
          fromShelter: { shelterName: "Brooklyn Shelter" },
          toShelter: { shelterName: "Athens Shelter" },
          fromStaff: null,
          toStaff: null,
        },
      ]);

      const res = await getPassport();

      expect(res.status).toBe(200);
      for (const model of ["healthRecord", "vaccinationRecord", "transferHistory"]) {
        expect(prisma[model].findMany.mock.calls[0][0].where).toEqual({ petID: 10 });
      }
      expect(res.body.data.healthRecords[0]).toMatchObject({
        recordDesc: "Intake exam at Brooklyn.",
        shelterName: "Brooklyn Shelter",
      });
      expect(res.body.data.vaccinations[0]).toMatchObject({
        vaccineName: "Rabies",
        status: "Up to Date",
      });
      expect(res.body.data.transferHistory[0]).toMatchObject({
        fromShelterName: "Brooklyn Shelter",
        toShelterName: "Athens Shelter",
      });
    });

    test("pet at another shelter → 404, nothing else read", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(petRow({ shelterID: 3 }));
      vetAtShelter(9);

      const res = await getPassport();

      expect(res.status).toBe(404);
      expect(prisma.healthRecord.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— POST /pets/:id/health-records —————————————————————————————
  describe("POST /api/v1/pets/:id/health-records", () => {
    const post = (body, id = 10, token = vetToken()) =>
      request(app)
        .post(`/api/v1/pets/${id}/health-records`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    test("pet at the vet's shelter → 201, vetID = caller, no appointment", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      vetAtShelter(9);
      prisma.healthRecord.create.mockResolvedValueOnce(recordRow());

      const res = await post({ recordDesc: "  Ear infection, drops prescribed.  ", vetID: 1 });

      expect(res.status).toBe(201);
      expect(prisma.healthRecord.create.mock.calls[0][0].data).toEqual({
        petID: 10,
        vetID: 70,
        recordDesc: "Ear infection, drops prescribed.",
      });
      expect(res.body.data).toMatchObject({
        recordID: 5,
        petID: 10,
        recordDesc: "Ear infection, drops prescribed.",
        appointmentID: null,
        vetName: "Jay Asarathi",
      });
    });

    test("pet at another shelter → 403, nothing written", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 3 });
      vetAtShelter(9);

      const res = await post({ recordDesc: "Checked." });

      expect(res.status).toBe(403);
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
    });

    test("unknown pet → 404", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(null);
      vetAtShelter(9);

      const res = await post({ recordDesc: "Checked." }, 999);

      expect(res.status).toBe(404);
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
    });

    test.each([
      ["missing recordDesc", {}],
      ["blank recordDesc", { recordDesc: "   " }],
      ["recordDesc over 500 chars", { recordDesc: "x".repeat(501) }],
      ["recordDesc not a string", { recordDesc: 42 }],
    ])("%s → 400, nothing read", async (_label, body) => {
      const res = await post(body);

      expect(res.status).toBe(400);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test.each(["Staff", "Admin"])("%s → 403", async (role) => {
      const res = await post({ recordDesc: "Checked." }, 10, signToken(role, 42));

      expect(res.status).toBe(403);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PUT /health-records/:id —————————————————————————————
  describe("PUT /api/v1/health-records/:id", () => {
    const put = (body, id = 5) =>
      request(app)
        .put(`/api/v1/health-records/${id}`)
        .set("Authorization", `Bearer ${vetToken()}`)
        .send(body);

    test("the vet who wrote it → 200, only recordDesc changes", async () => {
      prisma.healthRecord.findUnique.mockResolvedValueOnce({ vetID: 70 });
      prisma.healthRecord.update.mockResolvedValueOnce(recordRow({ recordDesc: "Updated." }));

      const res = await put({ recordDesc: "Updated.", petID: 99, vetID: 1 });

      expect(res.status).toBe(200);
      expect(prisma.healthRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recordID: 5 }, data: { recordDesc: "Updated." } }),
      );
      expect(res.body.data.recordDesc).toBe("Updated.");
    });

    test.each([
      ["another vet's record", 71],
      ["a record with no vet", null],
    ])("%s → 403, nothing written", async (_label, vetID) => {
      prisma.healthRecord.findUnique.mockResolvedValueOnce({ vetID });

      const res = await put({ recordDesc: "Updated." });

      expect(res.status).toBe(403);
      expect(prisma.healthRecord.update).not.toHaveBeenCalled();
    });

    test("unknown record → 404", async () => {
      prisma.healthRecord.findUnique.mockResolvedValueOnce(null);

      const res = await put({ recordDesc: "Updated." }, 999);

      expect(res.status).toBe(404);
    });

    test("blank recordDesc → 400, nothing read", async () => {
      const res = await put({ recordDesc: "" });

      expect(res.status).toBe(400);
      expect(prisma.healthRecord.findUnique).not.toHaveBeenCalled();
    });
  });
});
