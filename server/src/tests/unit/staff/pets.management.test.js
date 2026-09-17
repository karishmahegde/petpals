const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — pets.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  shelter: { findUnique: jest.fn() },
  breed: { findUnique: jest.fn() },
  pet: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  petPhoto: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  adoptionApplication: { findFirst: jest.fn() },
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// Public bucket — never actually hit; every call is asserted, not executed.
// toPublicFileUrl keeps its real (pure) implementation so response shapes
// stay realistic; only the network-touching functions are stubbed.
jest.mock("../../../services/storage", () => ({
  PET_IMAGES_BUCKET: "pet-images",
  uploadPrivateFile: jest.fn().mockResolvedValue(undefined),
  deletePrivateFile: jest.fn().mockResolvedValue(undefined),
  toPublicFileUrl: jest.fn((bucket, value) =>
    value ? `https://cdn.test/${bucket}/${value}` : value,
  ),
}));

// getPetDetails is the one collaborator worth stubbing — it's already
// covered by its own dedicated suite (public/pets.getPetDetails.test.js),
// and re-deriving its exact prisma.pet.findUnique select shape here would
// just duplicate that coverage. Everything else (toArray/matchFilter/
// buildAgeFilter/formatAgeFromDOBYears/formatSex) stays real, since
// listMyShelterPets's own filter-building is what's under test.
jest.mock("../../../services/public/pets.service", () => ({
  ...jest.requireActual("../../../services/public/pets.service"),
  getPetDetails: jest.fn(),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");
const publicPetsService = require("../../../services/public/pets.service");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = (userID = 42) => signToken("Staff", userID);
const adminToken = () => signToken("Admin");
const adopterToken = () => signToken("Adopter");

const VALID_CREATE_BODY = {
  breedID: 3,
  petName: "Rex",
  petDOB: "2021-01-01",
  petSex: "M",
  petColor: "Brown",
  petSize: "Medium",
  intakeDate: "2024-06-01",
  petWeight: 12.5,
  petHeight: 40,
};

const buildPetDetail = (overrides = {}) => ({
  petID: 10,
  petName: "Rex",
  petAge: "2 yr",
  petSex: "Male",
  petColor: "Brown",
  petHeight: 40,
  petWeight: 12.5,
  petDesc: null,
  petPhoto: "https://cdn.test/pet-images/placeholder.jpg",
  adoptionStatus: "available",
  breed: { breedID: 3, breedName: "Beagle", speciesName: "Dog" },
  shelter: { shelterID: 9, shelterName: "Athens Shelter", shelterAddress: "1 Main St" },
  compatibleWithChildren: false,
  compatibleWithPets: false,
  specialNeeds: false,
  ...overrides,
});

describe("Staff pet management endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
    publicPetsService.getPetDetails.mockResolvedValue(buildPetDetail());
  });

  // ————————————————————————————— GET /staff/me/pets —————————————————————————————
  describe("GET /api/v1/staff/me/pets", () => {
    test("scoped to the staff member's own shelterID", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.pet.findMany.mockResolvedValueOnce([
        {
          petID: 1,
          petName: "Rex",
          petDOB: new Date(2021, 0, 1),
          petPhoto: "pets/1/photo.jpg",
          petSex: "M",
          adoptionStatus: "incoming",
          breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
        },
      ]);
      prisma.pet.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/staff/me/pets")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shelterID: 9 } }),
      );
      expect(res.body.data[0].adoptionStatus).toBe("incoming");
      expect(res.body.pagination.total).toBe(1);
    });

    test("no shelter assigned → 409 CONFLICT", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await request(app)
        .get("/api/v1/staff/me/pets")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });

    test("invalid adoptionStatus value → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/staff/me/pets")
        .query({ adoptionStatus: "bogus" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— POST /pets —————————————————————————————
  describe("POST /api/v1/pets", () => {
    test("Staff: shelterID always resolved from req.user, never from the body", async () => {
      prisma.breed.findUnique.mockResolvedValueOnce({ breedID: 3 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.pet.create.mockResolvedValueOnce({ petID: 10 });

      const res = await request(app)
        .post("/api/v1/pets")
        .set("Authorization", `Bearer ${staffToken()}`)
        // shelterID: 999 here must be silently ignored for a Staff caller.
        .send({ ...VALID_CREATE_BODY, shelterID: 999 });

      expect(res.status).toBe(201);
      expect(prisma.pet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shelterID: 9 }),
        }),
      );
    });

    test("missing required field → 400 BAD_REQUEST, nothing written", async () => {
      const { petName: _omit, ...incomplete } = VALID_CREATE_BODY;

      const res = await request(app)
        .post("/api/v1/pets")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(incomplete);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.create).not.toHaveBeenCalled();
    });

    test("breedID doesn't reference an existing breed → 400 BAD_REQUEST, nothing written", async () => {
      prisma.breed.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/pets")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.create).not.toHaveBeenCalled();
    });

    test("Staff with no shelter assigned → 409 CONFLICT, nothing written", async () => {
      prisma.breed.findUnique.mockResolvedValueOnce({ breedID: 3 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await request(app)
        .post("/api/v1/pets")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.pet.create).not.toHaveBeenCalled();
    });

    test("Admin: shelterID required in the body (Admin has no home shelter)", async () => {
      const res = await request(app)
        .post("/api/v1/pets")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.create).not.toHaveBeenCalled();
    });

    test("Admin: valid shelterID in body is used directly, staff table never consulted", async () => {
      prisma.breed.findUnique.mockResolvedValueOnce({ breedID: 3 });
      prisma.shelter.findUnique.mockResolvedValueOnce({ shelterID: 4 });
      prisma.pet.create.mockResolvedValueOnce({ petID: 10 });

      const res = await request(app)
        .post("/api/v1/pets")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ...VALID_CREATE_BODY, shelterID: 4 });

      expect(res.status).toBe(201);
      expect(prisma.pet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shelterID: 4 }),
        }),
      );
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PUT /pets/:id —————————————————————————————
  describe("PUT /api/v1/pets/:id", () => {
    test("Staff editing their own shelter's pet → 200", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .put("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ petName: "Rex Jr." });

      expect(res.status).toBe(200);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 10 },
        data: { petName: "Rex Jr." },
      });
    });

    test("Staff editing another shelter's pet → 403 FORBIDDEN, nothing written", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 5 });

      const res = await request(app)
        .put("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ petName: "Rex Jr." });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.pet.update).not.toHaveBeenCalled();
    });

    test("pet not found → 404 NOT_FOUND", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put("/api/v1/pets/999")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ petName: "Rex Jr." });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    test("no updatable fields provided → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .put("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
      expect(prisma.pet.update).not.toHaveBeenCalled();
    });

    test("adoptionStatus is updatable (manual staff override)", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .put("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ adoptionStatus: "deceased" });

      expect(res.status).toBe(200);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 10 },
        data: { adoptionStatus: "deceased" },
      });
    });

    test("invalid adoptionStatus value → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .put("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ adoptionStatus: "bogus" });

      expect(res.status).toBe(400);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— DELETE /pets/:id —————————————————————————————
  describe("DELETE /api/v1/pets/:id", () => {
    test("no active application → 200, photos removed from storage then the row deleted", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        photos: [{ photoURL: "pets/10/photo-1.jpg" }],
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(storage.deletePrivateFile).toHaveBeenCalledWith(
        "pet-images",
        "pets/10/photo-1.jpg",
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test("pet has a Pending application → 409 CONFLICT, nothing written", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 9, photos: [] });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce({
        applicationID: 5,
      });

      const res = await request(app)
        .delete("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(storage.deletePrivateFile).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("Staff deleting another shelter's pet → 403 FORBIDDEN, nothing written", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({ shelterID: 9, photos: [] });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 5 });

      const res = await request(app)
        .delete("/api/v1/pets/10")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
      expect(prisma.adoptionApplication.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("pet not found → 404 NOT_FOUND", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/v1/pets/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————————————— PHOTOS —————————————————————————————
  describe("GET /api/v1/pets/:id/photos", () => {
    test("returns the gallery, flagged against the pet's current primary", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        petPhoto: "pets/10/photo-1.jpg",
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.petPhoto.findMany.mockResolvedValueOnce([
        { photoID: 1, photoURL: "pets/10/photo-1.jpg", uploadedAt: new Date() },
      ]);

      const res = await request(app)
        .get("/api/v1/pets/10/photos")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({ photoID: 1, isPrimary: true });
    });
  });

  describe("POST /api/v1/pets/:id/photos", () => {
    test("first photo uploaded becomes primary", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        petPhoto: "placeholder.jpg",
        photos: [],
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.petPhoto.findMany.mockResolvedValueOnce([
        { photoID: 2, photoURL: "pets/10/photo-2.jpg", uploadedAt: new Date() },
      ]);

      const res = await request(app)
        .post("/api/v1/pets/10/photos")
        .set("Authorization", `Bearer ${staffToken()}`)
        .attach("file", Buffer.from("fake-photo-bytes"), {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(201);
      expect(storage.uploadPrivateFile).toHaveBeenCalledWith(
        "pet-images",
        expect.stringMatching(/^pets\/10\/photo-\d+\.jpg$/),
        expect.any(Buffer),
        "image/jpeg",
      );
      // First photo -> the pet's petPhoto is updated too, inside the same transaction.
      expect(prisma.pet.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { petID: 10 } }),
      );
    });

    test("unsupported file type → 400 BAD_REQUEST, nothing uploaded", async () => {
      const res = await request(app)
        .post("/api/v1/pets/10/photos")
        .set("Authorization", `Bearer ${staffToken()}`)
        .attach("file", Buffer.from("not-an-image"), {
          filename: "doc.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
    });

    test("Staff uploading to another shelter's pet → 403 FORBIDDEN, nothing uploaded", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        petPhoto: "placeholder.jpg",
        photos: [],
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 5 });

      const res = await request(app)
        .post("/api/v1/pets/10/photos")
        .set("Authorization", `Bearer ${staffToken()}`)
        .attach("file", Buffer.from("fake-photo-bytes"), {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(403);
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/v1/pets/:id/photos/:photoId", () => {
    test("removing the primary photo promotes the earliest remaining one", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        petPhoto: "pets/10/photo-1.jpg",
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.petPhoto.findFirst
        .mockResolvedValueOnce({ photoID: 1, photoURL: "pets/10/photo-1.jpg" }) // the photo being deleted
        .mockResolvedValueOnce({ photoURL: "pets/10/photo-2.jpg" }); // next earliest, promoted
      prisma.petPhoto.findMany.mockResolvedValueOnce([
        { photoID: 2, photoURL: "pets/10/photo-2.jpg", uploadedAt: new Date() },
      ]);

      const res = await request(app)
        .delete("/api/v1/pets/10/photos/1")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 10 },
        data: { petPhoto: "pets/10/photo-2.jpg" },
      });
      expect(res.body.data[0]).toMatchObject({ photoID: 2, isPrimary: true });
    });

    test("photo doesn't belong to the pet → 404 NOT_FOUND", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        petPhoto: "pets/10/photo-1.jpg",
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.petPhoto.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/v1/pets/10/photos/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
      expect(storage.deletePrivateFile).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/staff/me/pets", undefined],
      ["post", "/api/v1/pets", VALID_CREATE_BODY],
      ["put", "/api/v1/pets/10", { petName: "Rex" }],
      ["delete", "/api/v1/pets/10", undefined],
      ["get", "/api/v1/pets/10/photos", undefined],
      ["delete", "/api/v1/pets/10/photos/1", undefined],
    ])(
      "%s %s: non-Staff/Admin role (Adopter) → 403 FORBIDDEN, nothing written",
      async (method, path, body) => {
        let req = request(app)
          [method](path)
          .set("Authorization", `Bearer ${adopterToken()}`);
        if (body) req = req.send(body);

        const res = await req;

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          success: false,
          error: { code: "FORBIDDEN" },
        });
        expect(prisma.pet.create).not.toHaveBeenCalled();
        expect(prisma.pet.update).not.toHaveBeenCalled();
        expect(prisma.pet.delete).not.toHaveBeenCalled();
      },
    );

    // GET /staff/me/pets is additionally Staff-ONLY — Admin has its own
    // separate oversight surface, not this shelter-scoped endpoint.
    test("GET /api/v1/staff/me/pets: Admin role → 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/staff/me/pets")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(403);
    });
  });
});
