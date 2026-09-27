const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database —
// adoptionApplications.service.js resolves this same file
// (server/src/config/prisma.js) via require("../../config/prisma"), so
// replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  adoptionApplication: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  pet: { update: jest.fn(), updateMany: jest.fn() },
  governmentID: { findFirst: jest.fn() },
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = (userID = 42) => signToken("Staff", userID);
const adminToken = (userID = 1) => signToken("Admin", userID);
const adopterToken = (userID = 7) => signToken("Adopter", userID);

// Matches STAFF_LIST_SELECT's shape in adoptionApplications.service.js.
const buildListRow = (overrides = {}) => ({
  applicationID: 1,
  applicationCode: "APP-00001",
  petID: 5,
  adopterID: 7,
  shelterID: 9,
  staffID: null,
  applicationStatus: "Pending",
  applicationType: "Adopt",
  createdAt: new Date("2026-01-01"),
  pet: {
    petName: "Rex",
    petPhoto: null,
    breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
  },
  adopter: {
    adopterName: "Emilie",
    user: { userEmail: "emilie@example.com" },
  },
  ...overrides,
});

// Matches APPLICATION_SELECT + the pet/shelter join updateApplicationStatus
// selects on its own update() call.
const buildUpdatedApplication = (overrides = {}) => ({
  applicationID: 1,
  petID: 5,
  adopterID: 7,
  shelterID: 9,
  staffID: null,
  applicationStatus: "Pending",
  applicationType: "Adopt",
  shelterMessage: null,
  paymentStatus: "Paid",
  amountPaid: 15,
  createdAt: new Date("2026-01-01"),
  pet: { petName: "Rex" },
  shelter: { shelterName: "Athens Shelter" },
  ...overrides,
});

describe("Application review workflow (Staff/Admin)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————— GET /api/v1/adoption-applications —————————————————————
  // section is required: "active" = Pending, "past" = Accepted/Rejected/Withdrawn.
  const ACTIVE_WHERE = { applicationStatus: { in: ["Pending"] } };
  const PAST_WHERE = { applicationStatus: { in: ["Accepted", "Rejected", "Withdrawn"] } };

  describe("GET /api/v1/adoption-applications (staff queue)", () => {
    test("Staff: scoped to their own shelter even with no filter applied", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([buildListRow()]);
      prisma.adoptionApplication.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/adoption-applications")
        .query({ section: "active" })
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(200);
      expect(prisma.adoptionApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ...ACTIVE_WHERE, shelterID: 9 } }),
      );
      expect(res.body.data).toHaveLength(1);
    });

    test("Staff: no shelter assigned → sentinel shelterID (-1), empty result, not an error", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([]);
      prisma.adoptionApplication.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/v1/adoption-applications")
        .query({ section: "active" })
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(200);
      expect(prisma.adoptionApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ...ACTIVE_WHERE, shelterID: -1 } }),
      );
      expect(res.body.data).toEqual([]);
    });

    test("Staff: section=past is applied alongside the shelter scope", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([]);
      prisma.adoptionApplication.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/adoption-applications")
        .query({ section: "past" })
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(prisma.adoptionApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ...PAST_WHERE, shelterID: 9 } }),
      );
    });

    test("Admin: an explicit ?shelterID= scopes the query, staff table never consulted", async () => {
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([]);
      prisma.adoptionApplication.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/adoption-applications")
        .query({ section: "active", shelterID: 3 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.adoptionApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ...ACTIVE_WHERE, shelterID: 3 } }),
      );
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("Admin: no shelterID param → unscoped, network-wide query", async () => {
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([]);
      prisma.adoptionApplication.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/adoption-applications")
        .query({ section: "active" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.adoptionApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: ACTIVE_WHERE }),
      );
    });

    test("missing section → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/adoption-applications")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.adoptionApplication.findMany).not.toHaveBeenCalled();
    });

    test("invalid section value → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/adoption-applications")
        .query({ section: "Bogus" })
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.adoptionApplication.findMany).not.toHaveBeenCalled();
    });

    // The route's own authorizeRoles allows Adopter through too (it's the
    // same path Adopter uses with ?checkoutSessionId=) — role separation for
    // the plain list happens inside the controller instead.
    test("Adopter without checkoutSessionId → 403 FORBIDDEN, nothing queried", async () => {
      const res = await request(app)
        .get("/api/v1/adoption-applications")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "FORBIDDEN" },
      });
      expect(prisma.adoptionApplication.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————— PATCH /api/v1/adoption-applications/:id/status —————————————————
  describe("PATCH /api/v1/adoption-applications/:id/status", () => {
    test("Accept on a Pending application: pet marked adopted, staffID set, the pet's other Pending applications declined", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
        pet: { petName: "Rex", adoptionStatus: "available" },
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.adoptionApplication.update.mockResolvedValueOnce(
        buildUpdatedApplication({ applicationStatus: "Accepted", staffID: 42 }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(200);
      expect(prisma.adoptionApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { applicationID: 1 },
          data: expect.objectContaining({
            applicationStatus: "Accepted",
            staffID: 42,
          }),
        }),
      );
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { petID: 5 },
        data: { adoptionStatus: "adopted" },
      });
      // Every OTHER Pending application for the same pet, with a remark the
      // applicant sees.
      expect(prisma.adoptionApplication.updateMany).toHaveBeenCalledWith({
        where: {
          petID: 5,
          applicationStatus: "Pending",
          applicationID: { not: 1 },
        },
        data: {
          applicationStatus: "Rejected",
          staffRemark: expect.stringContaining("Another applicant was approved for this pet"),
        },
      });
    });

    test("Accept when the pet is no longer available (already adopted) → 409, nothing written", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 2,
        adopterID: 8,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
        pet: { petName: "Rex", adoptionStatus: "adopted" },
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/adoption-applications/2/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Rex is no longer available — another application has already been accepted",
      );
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
      expect(prisma.pet.update).not.toHaveBeenCalled();
      expect(prisma.adoptionApplication.updateMany).not.toHaveBeenCalled();
    });

    // Two staff accepting different applications for the same pet at the
    // same moment both pass the availability check — the one-Accepted-per-
    // pet unique index stops the second, surfaced as the same 409.
    test("Accept losing a race to another acceptance (unique index) → 409", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 2,
        adopterID: 8,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
        pet: { petName: "Rex", adoptionStatus: "available" },
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.$transaction.mockRejectedValueOnce(
        Object.assign(new Error("duplicate"), { code: "P2002" }),
      );

      const res = await request(app)
        .patch("/api/v1/adoption-applications/2/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Rex is no longer available — another application has already been accepted",
      );
    });

    test("Accept on a non-Pending application → 409 CONFLICT, nothing written", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Accepted", // already resolved
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
      expect(prisma.pet.update).not.toHaveBeenCalled();
    });

    test("Reject on a Pending application: pet's adoptionStatus is left untouched, staffID not set", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.adoptionApplication.update.mockResolvedValueOnce(
        buildUpdatedApplication({ applicationStatus: "Rejected" }),
      );

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Rejected", staffRemark: "Not a good fit" });

      expect(res.status).toBe(200);
      expect(prisma.adoptionApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            applicationStatus: "Rejected",
            staffRemark: "Not a good fit",
          },
        }),
      );
      expect(prisma.pet.update).not.toHaveBeenCalled();
      // Rejecting one application leaves the pet's others as they are.
      expect(prisma.adoptionApplication.updateMany).not.toHaveBeenCalled();
    });

    test("Staff acting on another shelter's application → 403 FORBIDDEN, nothing written", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 3 }); // different shelter

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
      expect(prisma.pet.update).not.toHaveBeenCalled();
    });

    test("Admin accepting any shelter's application: no shelter restriction, staffID stays null (no Staff row of their own)", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
        pet: { petName: "Rex", adoptionStatus: "available" },
      });
      prisma.adoptionApplication.update.mockResolvedValueOnce(
        buildUpdatedApplication({ applicationStatus: "Accepted" }),
      );
      prisma.pet.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
      expect(prisma.adoptionApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { applicationStatus: "Accepted" }, // no staffID key at all
        }),
      );
    });

    test("application not found → 404 NOT_FOUND", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/adoption-applications/999/status")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(404);
    });

    // ————— Adopter branch of the same shared endpoint (Withdraw) —————
    // The route's authorizeRoles allows Adopter through — this endpoint is
    // Adopter's own self-service Withdraw action, not something they're
    // blanket-blocked from. What IS blocked is an Adopter reaching for a
    // Staff-only status value or acting on someone else's application.
    test("Adopter withdrawing their own Pending application → 200", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
      });
      prisma.adoptionApplication.update.mockResolvedValueOnce(
        buildUpdatedApplication({ applicationStatus: "Withdrawn" }),
      );

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ status: "Withdrawn" });

      expect(res.status).toBe(200);
      expect(prisma.pet.update).not.toHaveBeenCalled();
      expect(prisma.pet.updateMany).not.toHaveBeenCalled();
    });

    test("Adopter withdrawing their own Accepted application → 200, pet back to 'available' in the same transaction", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 7,
        shelterID: 9,
        petID: 5,
        applicationStatus: "Accepted",
      });
      prisma.adoptionApplication.update.mockResolvedValueOnce(
        buildUpdatedApplication({ applicationStatus: "Withdrawn" }),
      );
      prisma.pet.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ status: "Withdrawn" });

      expect(res.status).toBe(200);
      expect(prisma.pet.updateMany).toHaveBeenCalledWith({
        where: { petID: 5, adoptionStatus: "adopted" },
        data: { adoptionStatus: "available" },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
      ]);
    });

    test("Adopter withdrawing someone else's application → 403 FORBIDDEN", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce({
        applicationID: 1,
        adopterID: 999, // not the caller
        shelterID: 9,
        petID: 5,
        applicationStatus: "Pending",
      });

      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ status: "Withdrawn" });

      expect(res.status).toBe(403);
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
    });

    // Deviation from a literal "Adopter role -> 403" reading: this route is
    // shared with Adopter's own Withdraw action (authorizeRoles allows
    // Adopter through), so a Staff-only status value isn't rejected by role
    // at all — it just isn't in VALID_ADOPTER_STATUS_CHANGES, so it fails
    // the same generic value check any bogus string would (400, not 403).
    test("Adopter attempting a Staff-only status (Accepted) → 400 BAD_REQUEST, not 403", async () => {
      const res = await request(app)
        .patch("/api/v1/adoption-applications/1/status")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ status: "Accepted" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.adoptionApplication.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————— PATCH /api/v1/adoption-applications/:id (assign staff) —————————————————
  describe("PATCH /api/v1/adoption-applications/:id (assign staff)", () => {
    // Application 1 is at shelter 9, managed by staff 42. Staff 43 is an
    // Active member of shelter 9 — a valid assignee.
    const lookupRow = (overrides = {}) => ({
      shelterID: 9,
      applicationStatus: "Pending",
      shelter: { managerStaffID: 42 },
      ...overrides,
    });

    // Matches getApplicationById's select shape — the response re-reads the
    // application after the update.
    const detailRow = (overrides = {}) => ({
      ...buildUpdatedApplication({ staffID: 43 }),
      applicationCode: "APP-00001",
      staffRemark: null,
      pet: {
        petName: "Rex",
        petPhoto: null,
        breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
      },
      shelter: { shelterName: "Athens Shelter", managerStaffID: 42 },
      staff: { staffName: "Jo Park" },
      adopter: {
        adopterName: "Emilie",
        adopterPhone: null,
        housingType: null,
        ownsOrRents: null,
        landlordContact: null,
        householdSize: null,
        numChildren: null,
        preQualifyFlag: false,
        user: { userEmail: "emilie@example.com" },
      },
      ...overrides,
    });

    // The full happy-path sequence: lookup → assignee check → update → re-read.
    const mockSuccessfulAssign = () => {
      prisma.adoptionApplication.findUnique
        .mockResolvedValueOnce(lookupRow())
        .mockResolvedValueOnce(detailRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9, accountStatus: "Active" });
      prisma.adoptionApplication.update.mockResolvedValueOnce({});
      prisma.governmentID.findFirst.mockResolvedValueOnce({ verificationStatus: "Verified" });
    };

    const assign = (body, token = staffToken(42), id = 1) =>
      request(app)
        .patch(`/api/v1/adoption-applications/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    test("shelter manager assigns an Active staff member at the same shelter → 200 with the updated detail", async () => {
      mockSuccessfulAssign();

      const res = await assign({ staffID: 43 });

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique.mock.calls[0][0].where).toEqual({ userID: 43 });
      expect(prisma.adoptionApplication.update).toHaveBeenCalledWith({
        where: { applicationID: 1 },
        data: { staffID: 43 },
      });
      expect(res.body.data).toMatchObject({
        applicationID: 1,
        staffID: 43,
        assignedStaffName: "Jo Park",
        governmentIdStatus: "Verified",
        canAssignStaff: true,
      });
    });

    // The detail view (GET /adoption-applications/:id, also what an assign
    // returns) tells staff how many OTHER Pending applications the pet has
    // — accepting this one declines them all.
    test("GET detail as Staff → otherPendingCount counts the pet's other Pending applications", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce(detailRow());
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.adoptionApplication.count.mockResolvedValueOnce(2);

      const res = await request(app)
        .get("/api/v1/adoption-applications/1")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.otherPendingCount).toBe(2);
      expect(prisma.adoptionApplication.count).toHaveBeenCalledWith({
        where: {
          petID: 5,
          applicationStatus: "Pending",
          applicationID: { not: 1 },
        },
      });
    });

    test("GET detail as the Adopter → otherPendingCount is null, never counted", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce(detailRow());

      const res = await request(app)
        .get("/api/v1/adoption-applications/1")
        .set("Authorization", `Bearer ${adopterToken(7)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.otherPendingCount).toBeNull();
      expect(prisma.adoptionApplication.count).not.toHaveBeenCalled();
    });

    test("Admin can assign at any shelter without being its manager", async () => {
      mockSuccessfulAssign(); // shelter 9 is managed by staff 42, not this Admin

      const res = await assign({ staffID: 43 }, adminToken(1));

      expect(res.status).toBe(200);
      expect(prisma.adoptionApplication.update).toHaveBeenCalledTimes(1);
    });

    test("Staff who isn't the shelter's manager → 403 FORBIDDEN, nothing changed", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce(lookupRow());

      const res = await assign({ staffID: 43 }, staffToken(50));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
    });

    test.each(["Accepted", "Rejected", "Withdrawn"])(
      "%s application → 409 CONFLICT, nothing changed",
      async (applicationStatus) => {
        prisma.adoptionApplication.findUnique.mockResolvedValueOnce(
          lookupRow({ applicationStatus }),
        );

        const res = await assign({ staffID: 43 });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("CONFLICT");
        expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
      },
    );

    test.each([
      ["at another shelter", { shelterID: 3, accountStatus: "Active" }],
      ["not Active", { shelterID: 9, accountStatus: "Pending" }],
      ["not a staff member at all", null],
    ])("assignee %s → 400 BAD_REQUEST, nothing changed", async (_label, assignee) => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce(lookupRow());
      prisma.staff.findUnique.mockResolvedValueOnce(assignee);

      const res = await assign({ staffID: 43 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
    });

    test("application not found → 404 NOT_FOUND", async () => {
      prisma.adoptionApplication.findUnique.mockResolvedValueOnce(null);

      const res = await assign({ staffID: 43 }, staffToken(42), 999);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(prisma.adoptionApplication.update).not.toHaveBeenCalled();
    });

    test.each([
      ["missing staffID", {}, 1],
      ["non-integer staffID", { staffID: "abc" }, 1],
      ["zero staffID", { staffID: 0 }, 1],
      ["non-integer id", { staffID: 43 }, "abc"],
    ])("%s → 400 BAD_REQUEST, nothing queried", async (_label, body, id) => {
      const res = await assign(body, staffToken(42), id);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.adoptionApplication.findUnique).not.toHaveBeenCalled();
    });

    test("Adopter role → 403 FORBIDDEN, nothing queried", async () => {
      const res = await assign({ staffID: 43 }, adopterToken(7));

      expect(res.status).toBe(403);
      expect(prisma.adoptionApplication.findUnique).not.toHaveBeenCalled();
    });
  });
});
