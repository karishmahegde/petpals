const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  adopter: { findUnique: jest.fn(), update: jest.fn() },
  governmentID: { findFirst: jest.fn() },
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

// Just enough of ADOPTER_PROFILE_SELECT for toAdopterProfile to flatten.
const profileRow = (overrides = {}) => ({
  userID: 7,
  adopterName: "Ada Adopter",
  onboardingStep: 3,
  onboardingComplete: false,
  user: { emailVerified: true, lastLoginAt: null },
  ...overrides,
});

// Every field REQUIRED_FOR_COMPLETION checks, filled in.
const completeFields = (overrides = {}) => ({
  adopterDOB: new Date("1990-01-01"),
  adopterSex: "F",
  adopterPhone: "+12125550107",
  addressLine1: "1 Main St",
  city: "Brooklyn",
  state: "NY",
  zip: "11201",
  country: "US",
  housingType: "House",
  ownsOrRents: "Owns",
  householdSize: 2,
  numChildren: 0,
  employmentStatus: "Employed",
  activityLevel: "Medium",
  petExperience: "Some",
  ...overrides,
});

describe("Adopter onboarding", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("PATCH /api/v1/adopters/me/onboarding-step", () => {
    const advance = (step) =>
      request(app)
        .patch("/api/v1/adopters/me/onboarding-step")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send({ step });

    test.each([
      // [current step, step just completed, expected stored step]
      [2, 2, 3], // normal forward progress
      [3, 5, 6], // skipping ahead moves straight to step + 1
      [6, 3, 6], // re-saving an earlier step never moves backwards
      [5, 5, 6], // re-saving the current step is idempotent-ish
      [6, 6, 7], // last wizard step
      [7, 7, 7], // capped at 7
      [7, 2, 7], // already at the end — stays there
    ])("current %i, completed %i -> stored %i", async (current, step, expected) => {
      prisma.adopter.findUnique.mockResolvedValueOnce({ onboardingStep: current });
      prisma.adopter.update.mockResolvedValueOnce(profileRow({ onboardingStep: expected }));

      const res = await advance(step);

      expect(res.status).toBe(200);
      expect(prisma.adopter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 7 },
          data: { onboardingStep: expected },
        }),
      );
      expect(res.body.data.onboardingStep).toBe(expected);
    });

    test("response is the flattened profile (login fields hoisted, user relation dropped)", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce({ onboardingStep: 2 });
      prisma.adopter.update.mockResolvedValueOnce(profileRow());

      const res = await advance(2);

      expect(res.body.data.emailVerified).toBe(true);
      expect(res.body.data).not.toHaveProperty("user");
      expect(prisma.adopter.update.mock.calls[0][0].select).not.toHaveProperty(
        "stripeCustomerID",
      );
    });

    test("numeric string is accepted", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce({ onboardingStep: 2 });
      prisma.adopter.update.mockResolvedValueOnce(profileRow());

      const res = await advance("3");

      expect(res.status).toBe(200);
      expect(prisma.adopter.update.mock.calls[0][0].data).toEqual({ onboardingStep: 4 });
    });

    test.each([undefined, 1, 8, 2.5, "abc", null])("step %p -> 400, nothing read or written", async (step) => {
      const res = await advance(step);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("step must be an integer between 2 and 7");
      expect(prisma.adopter.findUnique).not.toHaveBeenCalled();
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });

    test("adopter row missing -> 404", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(null);

      const res = await advance(3);

      expect(res.status).toBe(404);
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });

    test("Staff -> 403", async () => {
      const res = await request(app)
        .patch("/api/v1/adopters/me/onboarding-step")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ step: 3 });

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/adopters/me/onboarding-complete", () => {
    const complete = () =>
      request(app)
        .patch("/api/v1/adopters/me/onboarding-complete")
        .set("Authorization", `Bearer ${adopterToken()}`);

    test("everything filled + government ID on file -> marked complete at step 7", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(completeFields());
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 3 });
      prisma.adopter.update.mockResolvedValueOnce(
        profileRow({ onboardingComplete: true, onboardingStep: 7 }),
      );

      const res = await complete();

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 7, userType: "Adopter" } }),
      );
      expect(prisma.adopter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 7 },
          data: { onboardingComplete: true, onboardingStep: 7 },
        }),
      );
      expect(res.body.data.onboardingComplete).toBe(true);
    });

    test("numChildren 0 counts as filled in (only null/undefined/'' are missing)", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(completeFields({ numChildren: 0 }));
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 3 });
      prisma.adopter.update.mockResolvedValueOnce(profileRow({ onboardingComplete: true }));

      const res = await complete();

      expect(res.status).toBe(200);
    });

    test.each([
      ["adopterDOB", null, "Date of birth"],
      ["adopterPhone", null, "Phone"],
      ["addressLine1", "", "Address line 1"],
      ["zip", "", "ZIP"],
      ["housingType", null, "Housing type"],
      ["householdSize", null, "Household size"],
      ["petExperience", undefined, "Pet experience"],
    ])("%s = %p -> 409 naming %s, nothing written", async (field, value, label) => {
      prisma.adopter.findUnique.mockResolvedValueOnce(completeFields({ [field]: value }));
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 3 });

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(`Onboarding is incomplete — missing: ${label}`);
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });

    test("no government ID -> 409 naming it", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(completeFields());
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Onboarding is incomplete — missing: Government ID");
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });

    test("several gaps -> all listed in one message, in field order, government ID last", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(
        completeFields({ adopterSex: null, city: "", employmentStatus: null }),
      );
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Onboarding is incomplete — missing: Sex, City, Employment status, Government ID",
      );
    });

    test("preferences (step 6) are not required", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(completeFields());
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 3 });
      prisma.adopter.update.mockResolvedValueOnce(profileRow({ onboardingComplete: true }));

      await complete();

      const { select } = prisma.adopter.findUnique.mock.calls[0][0];
      expect(select).not.toHaveProperty("preferredBreedID");
      expect(select).not.toHaveProperty("preferredSize");
      expect(select).not.toHaveProperty("openToSpecialNeeds");
    });

    test("adopter row missing -> 404", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(404);
      expect(prisma.governmentID.findFirst).not.toHaveBeenCalled();
    });

    test("row deleted between check and update (P2025) -> 404", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(completeFields());
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 3 });
      prisma.adopter.update.mockRejectedValueOnce(
        Object.assign(new Error("gone"), { code: "P2025" }),
      );

      const res = await complete();

      expect(res.status).toBe(404);
    });

    test("Staff -> 403", async () => {
      const res = await request(app)
        .patch("/api/v1/adopters/me/onboarding-complete")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/v1/adopters/me can't shortcut onboarding", () => {
    test.each(["onboardingComplete", "onboardingStep"])("%s in body -> 400", async (field) => {
      const res = await request(app)
        .put("/api/v1/adopters/me")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send({ [field]: field === "onboardingComplete" ? true : 7 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });
  });
});
