const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — transfers.service.js
// resolves this same file (server/src/config/prisma.js), so replacing it here
// replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  shelter: { findUnique: jest.fn() },
  pet: { findUnique: jest.fn(), update: jest.fn() },
  transferHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  // The service passes an array of already-invoked prisma calls — Promise.all
  // is a faithful enough stand-in for the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
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
const staffToken = (userID = 42) => signToken("Staff", userID);
const adminToken = () => signToken("Admin", 1);
const adopterToken = () => signToken("Adopter", 7);

// Pet 5 sits at shelter 9 (the origin); shelter 3 is the destination, whose
// manager is staff 60.
const ORIGIN = 9;
const DESTINATION = 3;
const DESTINATION_MANAGER = 60;

// Shape of TRANSFER_DETAIL_SELECT — what the service formats every response
// from.
const buildTransferRow = (overrides = {}) => ({
  recordID: 1,
  petID: 5,
  transferDate: new Date("2026-09-20"),
  fromShelterID: ORIGIN,
  toShelterID: DESTINATION,
  transferStatus: "In_Progress",
  transferReason: "Overcapacity",
  pet: {
    petName: "Rex",
    petPhoto: "pets/5/photo.jpg",
    petDOB: new Date("2021-01-01"),
    petSex: "M",
    petColor: "Brown",
    breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
  },
  fromShelter: { shelterName: "Athens Shelter" },
  toShelter: { shelterName: "Tifton Shelter", managerStaffID: DESTINATION_MANAGER },
  fromShelterStaff: 42,
  toShelterStaff: DESTINATION_MANAGER,
  fromStaff: { staffName: "Sasha Grey" },
  toStaff: { staffName: "Morgan Lee" },
  ...overrides,
});

const VALID_CREATE_BODY = {
  petID: 5,
  toShelterID: DESTINATION,
  transferReason: "Overcapacity",
};

describe("Transfers (Staff/Admin)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— POST /transfers —————————————————————————————
  describe("POST /api/v1/transfers", () => {
    // resolveShelterIDForCreate, then assertStaffOwnsShelter — both read the
    // caller's Staff row.
    const mockOriginStaff = () =>
      prisma.staff.findUnique
        .mockResolvedValueOnce({ shelterID: ORIGIN })
        .mockResolvedValueOnce({ shelterID: ORIGIN });

    test("Staff: pet goes In_Progress + 'transferred'; from = the initiator, to = the destination's manager", async () => {
      mockOriginStaff();
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: ORIGIN,
        adoptionStatus: "available",
      });
      prisma.shelter.findUnique.mockResolvedValueOnce({
        shelterID: DESTINATION,
        managerStaffID: DESTINATION_MANAGER,
      });
      prisma.transferHistory.create.mockResolvedValueOnce(buildTransferRow());
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ ...VALID_CREATE_BODY, transferReason: "  Overcapacity  " });

      expect(res.status).toBe(201);
      expect(prisma.transferHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            petID: 5,
            fromShelterID: ORIGIN,
            toShelterID: DESTINATION,
            transferReason: "Overcapacity",
            transferStatus: "In_Progress",
            fromShelterStaff: 42,
            toShelterStaff: DESTINATION_MANAGER,
          }),
        }),
      );
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 5 },
        data: { adoptionStatus: "transferred" },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test("destination with no manager → toShelterStaff null", async () => {
      mockOriginStaff();
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: ORIGIN,
        adoptionStatus: "available",
      });
      prisma.shelter.findUnique.mockResolvedValueOnce({
        shelterID: DESTINATION,
        managerStaffID: null,
      });
      prisma.transferHistory.create.mockResolvedValueOnce(
        buildTransferRow({ toShelterStaff: null, toStaff: null }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(201);
      expect(prisma.transferHistory.create.mock.calls[0][0].data.toShelterStaff).toBeNull();
    });

    test("pet not 'available' → 409 CONFLICT, nothing written", async () => {
      mockOriginStaff();
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: ORIGIN,
        adoptionStatus: "adopted",
      });

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
      expect(prisma.transferHistory.create).not.toHaveBeenCalled();
      expect(prisma.pet.update).not.toHaveBeenCalled();
    });

    test("Staff transferring another shelter's pet → 403 FORBIDDEN, nothing written", async () => {
      prisma.staff.findUnique
        .mockResolvedValueOnce({ shelterID: ORIGIN })
        .mockResolvedValueOnce({ shelterID: ORIGIN });
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: 77, // not the caller's shelter
        adoptionStatus: "available",
      });

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(403);
      expect(prisma.transferHistory.create).not.toHaveBeenCalled();
    });

    test("toShelterID = the pet's own shelter → 400 BAD_REQUEST", async () => {
      mockOriginStaff();
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: ORIGIN,
        adoptionStatus: "available",
      });

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ ...VALID_CREATE_BODY, toShelterID: ORIGIN });

      expect(res.status).toBe(400);
      expect(prisma.transferHistory.create).not.toHaveBeenCalled();
    });

    test("destination shelter doesn't exist → 404 NOT_FOUND", async () => {
      mockOriginStaff();
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: ORIGIN,
        adoptionStatus: "available",
      });
      prisma.shelter.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(404);
      expect(prisma.transferHistory.create).not.toHaveBeenCalled();
    });

    test("Staff with no shelter assigned → 409 CONFLICT", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("Admin: fromShelterID required → 400 when missing", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("Admin: fromShelterID that isn't the pet's shelter → 400 BAD_REQUEST", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ shelterID: 77 });
      prisma.pet.findUnique.mockResolvedValueOnce({
        petID: 5,
        shelterID: ORIGIN,
        adoptionStatus: "available",
      });

      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ...VALID_CREATE_BODY, fromShelterID: 77 });

      expect(res.status).toBe(400);
      expect(prisma.transferHistory.create).not.toHaveBeenCalled();
    });

    test.each([
      ["missing transferReason", { petID: 5, toShelterID: DESTINATION }],
      ["blank transferReason", { ...VALID_CREATE_BODY, transferReason: "   " }],
      ["transferReason over 300 chars", { ...VALID_CREATE_BODY, transferReason: "x".repeat(301) }],
      ["non-integer petID", { ...VALID_CREATE_BODY, petID: "abc" }],
    ])("%s → 400 BAD_REQUEST, nothing queried", async (_label, body) => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("Adopter → 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(403);
      expect(prisma.transferHistory.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /transfers —————————————————————————————
  describe("GET /api/v1/transfers", () => {
    test("Staff, direction=incoming → scoped to toShelterID; shelterName searches the OTHER (from) shelter", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: DESTINATION });
      prisma.transferHistory.findMany.mockResolvedValueOnce([buildTransferRow()]);
      prisma.transferHistory.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/transfers")
        .query({ direction: "incoming", shelterName: "athens", status: "In_Progress" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.transferHistory.findMany.mock.calls[0][0].where).toEqual({
        toShelterID: DESTINATION,
        transferStatus: "In_Progress",
        fromShelter: { shelterName: { contains: "athens", mode: "insensitive" } },
      });
      expect(res.body.data[0]).toMatchObject({ recordID: 1, pet: { petName: "Rex" } });
    });

    test("Staff, direction=outgoing → scoped to fromShelterID", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: ORIGIN });
      prisma.transferHistory.findMany.mockResolvedValueOnce([]);
      prisma.transferHistory.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/transfers")
        .query({ direction: "outgoing" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(prisma.transferHistory.findMany.mock.calls[0][0].where).toEqual({
        fromShelterID: ORIGIN,
      });
    });

    test("Staff with no shelter → sentinel -1, empty result, not an error", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });
      prisma.transferHistory.findMany.mockResolvedValueOnce([]);
      prisma.transferHistory.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/v1/transfers")
        .query({ direction: "incoming" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.transferHistory.findMany.mock.calls[0][0].where).toEqual({
        toShelterID: -1,
      });
    });

    test("Admin with no shelterID → unscoped", async () => {
      prisma.transferHistory.findMany.mockResolvedValueOnce([]);
      prisma.transferHistory.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/transfers")
        .query({ direction: "incoming" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.transferHistory.findMany.mock.calls[0][0].where).toEqual({});
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test.each([
      ["missing direction", {}],
      ["invalid direction", { direction: "sideways" }],
      ["invalid status", { direction: "incoming", status: "Pending" }],
    ])("%s → 400 BAD_REQUEST", async (_label, query) => {
      const res = await request(app)
        .get("/api/v1/transfers")
        .query(query)
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.transferHistory.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /transfers/:id —————————————————————————————
  describe("GET /api/v1/transfers/:id", () => {
    test.each([
      ["origin", ORIGIN],
      ["destination", DESTINATION],
    ])("Staff at the %s shelter can view it", async (_side, shelterID) => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(buildTransferRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID });

      const res = await request(app)
        .get("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        recordID: 1,
        transferReason: "Overcapacity",
        fromStaff: { staffName: "Sasha Grey" },
        toStaff: { staffName: "Morgan Lee" },
      });
    });

    test("Staff at an unrelated shelter → 403 FORBIDDEN", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(buildTransferRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 77 });

      const res = await request(app)
        .get("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });

    test("canReassignToShelterStaff: true only for the destination's manager while In_Progress", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(buildTransferRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: DESTINATION });
      const managerRes = await request(app)
        .get("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(DESTINATION_MANAGER)}`);
      expect(managerRes.body.data.canReassignToShelterStaff).toBe(true);

      prisma.transferHistory.findUnique.mockResolvedValueOnce(buildTransferRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: DESTINATION });
      const colleagueRes = await request(app)
        .get("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(61)}`);
      expect(colleagueRes.body.data.canReassignToShelterStaff).toBe(false);

      prisma.transferHistory.findUnique.mockResolvedValueOnce(
        buildTransferRow({ transferStatus: "Completed" }),
      );
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: DESTINATION });
      const closedRes = await request(app)
        .get("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(DESTINATION_MANAGER)}`);
      expect(closedRes.body.data.canReassignToShelterStaff).toBe(false);
    });

    test("not found → 404 NOT_FOUND", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/transfers/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————————————— PATCH /transfers/:id/status —————————————————————————————
  describe("PATCH /api/v1/transfers/:id/status", () => {
    const openTransfer = (overrides = {}) => ({
      recordID: 1,
      petID: 5,
      fromShelterID: ORIGIN,
      toShelterID: DESTINATION,
      transferStatus: "In_Progress",
      ...overrides,
    });

    test("destination approves (Completed): pet moves to the new shelter, back to 'available', staffID cleared", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(openTransfer());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: DESTINATION });
      prisma.transferHistory.update.mockResolvedValueOnce(
        buildTransferRow({ transferStatus: "Completed" }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status: "Completed" });

      expect(res.status).toBe(200);
      expect(res.body.data.transferStatus).toBe("Completed");
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 5 },
        data: { shelterID: DESTINATION, adoptionStatus: "available", staffID: null },
      });
    });

    test("destination declines (Rejected): pet stays put, back to 'available'", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(openTransfer());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: DESTINATION });
      prisma.transferHistory.update.mockResolvedValueOnce(
        buildTransferRow({ transferStatus: "Rejected" }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status: "Rejected" });

      expect(res.status).toBe(200);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 5 },
        data: { adoptionStatus: "available" },
      });
    });

    test("origin cancels (Cancelled): pet stays put, back to 'available'", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(openTransfer());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: ORIGIN });
      prisma.transferHistory.update.mockResolvedValueOnce(
        buildTransferRow({ transferStatus: "Cancelled" }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status: "Cancelled" });

      expect(res.status).toBe(200);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 5 },
        data: { adoptionStatus: "available" },
      });
    });

    test.each([
      ["origin can't approve", "Completed", ORIGIN],
      ["origin can't decline", "Rejected", ORIGIN],
      ["destination can't cancel", "Cancelled", DESTINATION],
    ])("%s → 403 FORBIDDEN, nothing written", async (_label, status, callerShelter) => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(openTransfer());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: callerShelter });

      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status });

      expect(res.status).toBe(403);
      expect(prisma.transferHistory.update).not.toHaveBeenCalled();
      expect(prisma.pet.update).not.toHaveBeenCalled();
    });

    test("already resolved → 409 CONFLICT, nothing written", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(
        openTransfer({ transferStatus: "Completed" }),
      );
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: ORIGIN });

      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status: "Cancelled" });

      expect(res.status).toBe(409);
      expect(prisma.transferHistory.update).not.toHaveBeenCalled();
    });

    test("Admin: either side's action, no shelter check", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(openTransfer());
      prisma.transferHistory.update.mockResolvedValueOnce(
        buildTransferRow({ transferStatus: "Completed" }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ status: "Completed" });

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("invalid status (In_Progress isn't a target) → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .patch("/api/v1/transfers/1/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status: "In_Progress" });

      expect(res.status).toBe(400);
      expect(prisma.transferHistory.findUnique).not.toHaveBeenCalled();
    });

    test("not found → 404 NOT_FOUND", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/transfers/999/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ status: "Cancelled" });

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————————————— PATCH /transfers/:id (reassign) —————————————————————————————
  describe("PATCH /api/v1/transfers/:id (reassign destination staff)", () => {
    const reassignable = (overrides = {}) => ({
      toShelterID: DESTINATION,
      transferStatus: "In_Progress",
      toShelter: { managerStaffID: DESTINATION_MANAGER },
      ...overrides,
    });

    test("destination manager → Active staff at the destination: 200", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(reassignable());
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: DESTINATION,
        accountStatus: "Active",
      });
      prisma.transferHistory.update.mockResolvedValueOnce(
        buildTransferRow({ toShelterStaff: 61, toStaff: { staffName: "Jo Park" } }),
      );

      const res = await request(app)
        .patch("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(DESTINATION_MANAGER)}`)
        .send({ toShelterStaff: 61 });

      expect(res.status).toBe(200);
      expect(prisma.transferHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { toShelterStaff: 61 } }),
      );
    });

    test("anyone but the destination manager → 403 FORBIDDEN", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(reassignable());

      const res = await request(app)
        .patch("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(61)}`)
        .send({ toShelterStaff: 62 });

      expect(res.status).toBe(403);
      expect(prisma.transferHistory.update).not.toHaveBeenCalled();
    });

    test("resolved transfer → 409 CONFLICT", async () => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(
        reassignable({ transferStatus: "Rejected" }),
      );

      const res = await request(app)
        .patch("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(DESTINATION_MANAGER)}`)
        .send({ toShelterStaff: 61 });

      expect(res.status).toBe(409);
      expect(prisma.transferHistory.update).not.toHaveBeenCalled();
    });

    test.each([
      ["at another shelter", { shelterID: ORIGIN, accountStatus: "Active" }],
      ["not Active", { shelterID: DESTINATION, accountStatus: "Deactivated" }],
      ["nonexistent", null],
    ])("assignee %s → 400 BAD_REQUEST", async (_label, assignee) => {
      prisma.transferHistory.findUnique.mockResolvedValueOnce(reassignable());
      prisma.staff.findUnique.mockResolvedValueOnce(assignee);

      const res = await request(app)
        .patch("/api/v1/transfers/1")
        .set("Authorization", `Bearer ${staffToken(DESTINATION_MANAGER)}`)
        .send({ toShelterStaff: 61 });

      expect(res.status).toBe(400);
      expect(prisma.transferHistory.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /transfers/assignees —————————————————————————————
  describe("GET /api/v1/transfers/assignees", () => {
    test("previews from = the caller, to = the destination's manager", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ userID: 42, staffName: "Sasha Grey" });
      prisma.shelter.findUnique.mockResolvedValueOnce({
        manager: { userID: DESTINATION_MANAGER, staffName: "Morgan Lee" },
      });

      const res = await request(app)
        .get("/api/v1/transfers/assignees")
        .query({ toShelterID: DESTINATION })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        fromShelterStaff: { staffID: 42, staffName: "Sasha Grey" },
        toShelterStaff: { staffID: DESTINATION_MANAGER, staffName: "Morgan Lee" },
      });
    });

    test("destination doesn't exist → 404 NOT_FOUND", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ userID: 42, staffName: "Sasha Grey" });
      prisma.shelter.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/transfers/assignees")
        .query({ toShelterID: 999 })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });
  });
});
