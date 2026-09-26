const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  species: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  breed: { findFirst: jest.fn(), create: jest.fn() },
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

describe("Species & breed management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— POST /species —————————————————————————————
  describe("POST /api/v1/species", () => {
    test("Staff: creates a trimmed species → 201", async () => {
      prisma.species.findFirst.mockResolvedValueOnce(null);
      prisma.species.create.mockResolvedValueOnce({
        speciesID: 7,
        speciesName: "Rabbit",
      });

      const res = await request(app)
        .post("/api/v1/species")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ speciesName: "  Rabbit  " });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({ speciesID: 7, speciesName: "Rabbit" });
      expect(prisma.species.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { speciesName: "Rabbit" } }),
      );
    });

    test("duplicate name (case-insensitive) → 409 CONFLICT, nothing written", async () => {
      prisma.species.findFirst.mockResolvedValueOnce({ speciesID: 1 });

      const res = await request(app)
        .post("/api/v1/species")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ speciesName: "dog" });

      expect(res.status).toBe(409);
      expect(prisma.species.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { speciesName: { equals: "dog", mode: "insensitive" } },
        }),
      );
      expect(prisma.species.create).not.toHaveBeenCalled();
    });

    test("blank or too-long name → 400 BAD_REQUEST, nothing queried", async () => {
      for (const speciesName of ["   ", "x".repeat(46), undefined]) {
        const res = await request(app)
          .post("/api/v1/species")
          .set("Authorization", `Bearer ${signToken("Staff")}`)
          .send({ speciesName });
        expect(res.status).toBe(400);
      }
      expect(prisma.species.findFirst).not.toHaveBeenCalled();
    });

    test("Adopter → 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/species")
        .set("Authorization", `Bearer ${signToken("Adopter")}`)
        .send({ speciesName: "Rabbit" });

      expect(res.status).toBe(403);
      expect(prisma.species.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— POST /breeds —————————————————————————————
  describe("POST /api/v1/breeds", () => {
    test("Admin: creates a breed → 201 in GET /breeds' item shape", async () => {
      prisma.species.findUnique.mockResolvedValueOnce({ speciesName: "Dog" });
      prisma.breed.findFirst.mockResolvedValueOnce(null);
      prisma.breed.create.mockResolvedValueOnce({
        breedID: 30,
        breedName: "Shiba Inu",
      });

      const res = await request(app)
        .post("/api/v1/breeds")
        .set("Authorization", `Bearer ${signToken("Admin")}`)
        .send({ speciesID: 1, breedName: "Shiba Inu" });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        breedID: 30,
        breedName: "Shiba Inu",
        speciesName: "Dog",
      });
    });

    test("unknown speciesID → 404 NOT_FOUND, nothing written", async () => {
      prisma.species.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/breeds")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ speciesID: 99, breedName: "Shiba Inu" });

      expect(res.status).toBe(404);
      expect(prisma.breed.create).not.toHaveBeenCalled();
    });

    test("duplicate breed within the species → 409 CONFLICT, nothing written", async () => {
      prisma.species.findUnique.mockResolvedValueOnce({ speciesName: "Dog" });
      prisma.breed.findFirst.mockResolvedValueOnce({ breedID: 3 });

      const res = await request(app)
        .post("/api/v1/breeds")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ speciesID: 1, breedName: "beagle" });

      expect(res.status).toBe(409);
      expect(prisma.breed.create).not.toHaveBeenCalled();
    });

    test("invalid speciesID → 400 BAD_REQUEST, nothing queried", async () => {
      const res = await request(app)
        .post("/api/v1/breeds")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ speciesID: "abc", breedName: "Shiba Inu" });

      expect(res.status).toBe(400);
      expect(prisma.species.findUnique).not.toHaveBeenCalled();
    });
  });
});
