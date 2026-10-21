// Adopter favorites (POST/DELETE /pets/:id/favorites, GET /adopters/me/favorites)
// and an adopted pet's vaccination history
// (GET /adopters/me/adopted-pets/:petId/vaccinations). Prisma is mocked.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../config/prisma", () => ({
  pet: { findUnique: jest.fn() },
  favorite: { create: jest.fn(), delete: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  adoptionApplication: { findFirst: jest.fn() },
  vaccinationRecord: { findMany: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const ADOPTER_ID = 7;
const signToken = (role, userID = ADOPTER_ID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const as = (role) => ({ Authorization: `Bearer ${signToken(role)}` });

// Prisma's own error shapes for a duplicate and a missing row.
const prismaError = (code) => Object.assign(new Error(code), { code });

// A row in PET_DETAIL_SELECT's shape.
const petRow = (overrides = {}) => ({
  petID: 12,
  petName: "Biscuit",
  petDOB: new Date("2023-01-01"),
  petSex: "F",
  petColor: "Tan",
  petPhoto: "biscuit.jpg",
  petHeight: 40,
  petWeight: 12,
  petDesc: "Loves walks",
  adoptionStatus: "available",
  compatibleWithChildren: true,
  compatibleWithPets: false,
  specialNeeds: false,
  breed: { breedID: 3, breedName: "Beagle", species: { speciesName: "Dog" } },
  shelter: { shelterID: 9, shelterName: "Downtown", shelterAddress: "1 Main St" },
  ...overrides,
});

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  authService.getAccountStatus.mockResolvedValue("Active");
  // The error handler logs every error response.
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ————————————————————— POST /pets/:id/favorites —————————————————————
describe("POST /api/v1/pets/:id/favorites", () => {
  test("adds the pet to the caller's favorites → 201", async () => {
    prisma.pet.findUnique.mockResolvedValue({ petID: 12 });
    prisma.favorite.create.mockResolvedValue({ adopterID: ADOPTER_ID, petID: 12 });

    const res = await request(app).post("/api/v1/pets/12/favorites").set(as("Adopter"));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ adopterID: ADOPTER_ID, petID: 12 });
    expect(prisma.favorite.create).toHaveBeenCalledWith({
      data: { adopterID: ADOPTER_ID, petID: 12 },
      select: { adopterID: true, petID: true },
    });
  });

  test("unknown pet → 404, nothing written", async () => {
    prisma.pet.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/v1/pets/99/favorites").set(as("Adopter"));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("No pet exists with ID 99");
    expect(prisma.favorite.create).not.toHaveBeenCalled();
  });

  test("already a favorite (composite key exists) → 409", async () => {
    prisma.pet.findUnique.mockResolvedValue({ petID: 12 });
    prisma.favorite.create.mockRejectedValue(prismaError("P2002"));

    const res = await request(app).post("/api/v1/pets/12/favorites").set(as("Adopter"));

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("This pet is already in your favorites");
  });

  test("any other database error → 500", async () => {
    prisma.pet.findUnique.mockResolvedValue({ petID: 12 });
    prisma.favorite.create.mockRejectedValue(new Error("connection lost"));

    const res = await request(app).post("/api/v1/pets/12/favorites").set(as("Adopter"));

    expect(res.status).toBe(500);
  });

  test.each(["abc", "0", "-3", "1.5"])("pet id %s → 400, nothing looked up", async (id) => {
    const res = await request(app).post(`/api/v1/pets/${id}/favorites`).set(as("Adopter"));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("pet id must be a positive integer");
    expect(prisma.pet.findUnique).not.toHaveBeenCalled();
  });

  test("not an Adopter → 403", async () => {
    const res = await request(app).post("/api/v1/pets/12/favorites").set(as("Staff"));

    expect(res.status).toBe(403);
    expect(prisma.pet.findUnique).not.toHaveBeenCalled();
  });

  test("no token → 401", async () => {
    const res = await request(app).post("/api/v1/pets/12/favorites");

    expect(res.status).toBe(401);
  });
});

// ————————————————————— DELETE /pets/:id/favorites —————————————————————
describe("DELETE /api/v1/pets/:id/favorites", () => {
  test("removes the caller's own favorite → 200", async () => {
    prisma.favorite.delete.mockResolvedValue({});

    const res = await request(app).delete("/api/v1/pets/12/favorites").set(as("Adopter"));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Pet removed from favorites");
    expect(prisma.favorite.delete).toHaveBeenCalledWith({
      where: { adopterID_petID: { adopterID: ADOPTER_ID, petID: 12 } },
    });
  });

  test("not a favorite (no such row) → 404", async () => {
    prisma.favorite.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app).delete("/api/v1/pets/12/favorites").set(as("Adopter"));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("This pet is not in your favorites");
  });

  test("any other database error → 500", async () => {
    prisma.favorite.delete.mockRejectedValue(new Error("connection lost"));

    const res = await request(app).delete("/api/v1/pets/12/favorites").set(as("Adopter"));

    expect(res.status).toBe(500);
  });

  test("invalid pet id → 400", async () => {
    const res = await request(app).delete("/api/v1/pets/x/favorites").set(as("Adopter"));

    expect(res.status).toBe(400);
    expect(prisma.favorite.delete).not.toHaveBeenCalled();
  });
});

// ————————————————————— GET /adopters/me/favorites —————————————————————
describe("GET /api/v1/adopters/me/favorites", () => {
  test("the caller's favorites in the pet-detail shape, by pet name, paged", async () => {
    prisma.favorite.findMany.mockResolvedValue([{ pet: petRow() }]);
    prisma.favorite.count.mockResolvedValue(21);

    const res = await request(app)
      .get("/api/v1/adopters/me/favorites?page=2&limit=10")
      .set(as("Adopter"));

    expect(res.status).toBe(200);
    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adopterID: ADOPTER_ID },
        orderBy: { pet: { petName: "asc" } },
        skip: 10,
        take: 10,
      }),
    );
    expect(res.body.data[0]).toMatchObject({
      petID: 12,
      petName: "Biscuit",
      petSex: "Female",
      breed: { breedID: 3, breedName: "Beagle", speciesName: "Dog" },
      shelter: { shelterID: 9, shelterName: "Downtown" },
    });
    expect(res.body.data[0]).not.toHaveProperty("petDOB");
    expect(res.body.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  test("defaults to page 1 of 20", async () => {
    prisma.favorite.findMany.mockResolvedValue([]);
    prisma.favorite.count.mockResolvedValue(0);

    const res = await request(app).get("/api/v1/adopters/me/favorites").set(as("Adopter"));

    expect(res.status).toBe(200);
    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(res.body.data).toEqual([]);
  });

  test.each([
    ["page=0", "page must be an integer >= 1"],
    ["page=abc", "page must be an integer >= 1"],
    ["limit=0", "limit must be an integer between 1 and 100"],
    ["limit=101", "limit must be an integer between 1 and 100"],
  ])("%s → 400", async (query, message) => {
    const res = await request(app)
      .get(`/api/v1/adopters/me/favorites?${query}`)
      .set(as("Adopter"));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(prisma.favorite.findMany).not.toHaveBeenCalled();
  });

  test("a database error → 500", async () => {
    prisma.favorite.findMany.mockRejectedValue(new Error("connection lost"));
    prisma.favorite.count.mockResolvedValue(0);

    const res = await request(app).get("/api/v1/adopters/me/favorites").set(as("Adopter"));

    expect(res.status).toBe(500);
  });
});

// ————————————————————— GET /adopters/me/adopted-pets/:petId/vaccinations —————————————————————
describe("GET /api/v1/adopters/me/adopted-pets/:petId/vaccinations", () => {
  test("the pet's doses, newest first, for an adopter with an Accepted application", async () => {
    prisma.adoptionApplication.findFirst.mockResolvedValue({ applicationID: 4 });
    prisma.vaccinationRecord.findMany.mockResolvedValue([
      {
        recordID: 2,
        administeredDate: new Date("2026-09-01"),
        dueDate: null,
        vaccine: { vaccineName: "Rabies" },
        vet: { vetName: "Dr. Vee" },
      },
      {
        recordID: 1,
        administeredDate: new Date("2026-03-01"),
        dueDate: new Date("2027-03-01"),
        vaccine: { vaccineName: "DHPP" },
        vet: null,
      },
    ]);

    const res = await request(app)
      .get("/api/v1/adopters/me/adopted-pets/12/vaccinations")
      .set(as("Adopter"));

    expect(res.status).toBe(200);
    expect(prisma.adoptionApplication.findFirst).toHaveBeenCalledWith({
      where: { adopterID: ADOPTER_ID, petID: 12, applicationStatus: "Accepted" },
      select: { applicationID: true },
    });
    expect(prisma.vaccinationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { petID: 12 }, orderBy: { administeredDate: "desc" } }),
    );
    expect(res.body.data).toEqual([
      {
        recordID: 2,
        vaccineName: "Rabies",
        administeredDate: "2026-09-01T00:00:00.000Z",
        dueDate: null,
        vetName: "Dr. Vee",
      },
      // A dose whose vet has since left keeps its history with no name.
      {
        recordID: 1,
        vaccineName: "DHPP",
        administeredDate: "2026-03-01T00:00:00.000Z",
        dueDate: "2027-03-01T00:00:00.000Z",
        vetName: null,
      },
    ]);
  });

  test("no Accepted application for the pet → 403, no records read", async () => {
    prisma.adoptionApplication.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/v1/adopters/me/adopted-pets/12/vaccinations")
      .set(as("Adopter"));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "You can only view vaccination history for pets you have adopted",
    );
    expect(prisma.vaccinationRecord.findMany).not.toHaveBeenCalled();
  });

  test("invalid petId → 400", async () => {
    const res = await request(app)
      .get("/api/v1/adopters/me/adopted-pets/abc/vaccinations")
      .set(as("Adopter"));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("petId must be a positive integer");
    expect(prisma.adoptionApplication.findFirst).not.toHaveBeenCalled();
  });
});
