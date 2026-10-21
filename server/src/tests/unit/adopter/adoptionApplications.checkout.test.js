// The adopter's side of applying (adoptionApplications controller + service):
// POST /adoption-applications — body checks, the eligibility checks, reusing
// or creating the Stripe customer, and the Checkout Session — then the
// confirmation page's poll (GET ?checkoutSessionId=), an adopter's view of an
// application, and the adopter's own lists. Prisma, Stripe and the
// email-verification gate are mocked.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../config/prisma", () => ({
  pet: { findUnique: jest.fn() },
  adopter: { findUnique: jest.fn(), update: jest.fn() },
  adoptionApplication: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  governmentID: { findFirst: jest.fn() },
}));
jest.mock("../../../config/stripe", () => ({
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
}));
jest.mock("../../../services/auth/emailVerification.service", () => ({
  ...jest.requireActual("../../../services/auth/emailVerification.service"),
  assertEmailVerified: jest.fn(),
}));
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const stripe = require("../../../config/stripe");
const { assertEmailVerified } = require("../../../services/auth/emailVerification.service");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const ADOPTER_ID = 7;
const auth = (role = "Adopter", userID = ADOPTER_ID) => ({
  Authorization: `Bearer ${jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
});

const VALID_BODY = { petID: 12, shelterID: 3, applicationType: "Adopt" };
const apply = (body = VALID_BODY) =>
  request(app).post("/api/v1/adoption-applications").set(auth()).send(body);

// Everything that lets a checkout go through.
const eligible = () => {
  prisma.pet.findUnique.mockResolvedValue({ petID: 12, adoptionStatus: "available", shelterID: 3 });
  prisma.adoptionApplication.findFirst.mockResolvedValue(null);
  prisma.adopter.findUnique.mockResolvedValue({
    stripeCustomerID: "cus_existing",
    adopterName: "Emelie",
    user: { userEmail: "emelie@example.com" },
  });
  stripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
};

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  authService.getAccountStatus.mockResolvedValue("Active");
  assertEmailVerified.mockResolvedValue(undefined);
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ————————————————————— POST /adoption-applications —————————————————————
describe("POST /api/v1/adoption-applications", () => {
  test("an eligible application → 201 with the Stripe Checkout URL; no row yet", async () => {
    eligible();

    const res = await apply({ ...VALID_BODY, shelterMessage: "  We have a big yard  " });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const session = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(session).toMatchObject({
      customer: "cus_existing",
      mode: "payment",
      metadata: {
        petID: "12",
        adopterID: String(ADOPTER_ID),
        shelterID: "3",
        applicationType: "Adopt",
        shelterMessage: "We have a big yard",
      },
    });
    expect(session.success_url).toMatch(/\/adopt\/apply\/12\/confirmation\?session_id=\{CHECKOUT_SESSION_ID\}$/);
    expect(session.cancel_url).toMatch(/\/adopt\/apply\/12$/);
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  test("first application: a Stripe customer is created and saved on the adopter", async () => {
    eligible();
    prisma.adopter.findUnique.mockResolvedValue({
      stripeCustomerID: null,
      adopterName: "Emelie",
      user: { userEmail: "emelie@example.com" },
    });
    stripe.customers.create.mockResolvedValue({ id: "cus_new" });

    const res = await apply();

    expect(res.status).toBe(201);
    expect(stripe.customers.create).toHaveBeenCalledWith({ name: "Emelie", email: "emelie@example.com" });
    expect(prisma.adopter.update).toHaveBeenCalledWith({
      where: { userID: ADOPTER_ID },
      data: { stripeCustomerID: "cus_new" },
    });
    expect(stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe("cus_new");
  });

  test("a blank message is stored as none", async () => {
    eligible();

    await apply({ ...VALID_BODY, shelterMessage: "   " });

    expect(stripe.checkout.sessions.create.mock.calls[0][0].metadata.shelterMessage).toBe("");
  });

  describe("refused before any charge", () => {
    test.each([
      [{ shelterID: 3, applicationType: "Adopt" }, 400, "petID is required and must be a positive integer"],
      [{ petID: 12, applicationType: "Adopt" }, 400, "shelterID is required and must be a positive integer"],
      [{ petID: 12, shelterID: 3, applicationType: "Buy" }, 400, "applicationType is required and must be one of: Adopt, Foster"],
      [{ ...VALID_BODY, shelterMessage: 7 }, 400, "shelterMessage must be a string of at most 500 characters"],
      [{ ...VALID_BODY, shelterMessage: "m".repeat(501) }, 400, "shelterMessage must be a string of at most 500 characters"],
    ])("%j → %i", async (body, status, message) => {
      const res = await apply(body);

      expect(res.status).toBe(status);
      expect(res.body.message).toBe(message);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    test("unverified email → 409 email_unverified, nothing looked up", async () => {
      assertEmailVerified.mockRejectedValue(
        Object.assign(new Error("Verify your email address before applying to adopt"), {
          code: "CONFLICT",
          details: { reason: "email_unverified" },
        }),
      );

      const res = await apply();

      expect(res.status).toBe(409);
      expect(res.body.error.details).toEqual({ reason: "email_unverified" });
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test.each([
      ["unknown pet", () => prisma.pet.findUnique.mockResolvedValue(null), 404, "No pet exists with ID 12"],
      [
        "pet not available",
        () => prisma.pet.findUnique.mockResolvedValue({ petID: 12, adoptionStatus: "adopted", shelterID: 3 }),
        409,
        "This pet is not currently available for adoption",
      ],
      [
        "shelterID isn't the pet's shelter",
        () => prisma.pet.findUnique.mockResolvedValue({ petID: 12, adoptionStatus: "available", shelterID: 9 }),
        400,
        "shelterID does not match the pet's shelter",
      ],
      [
        "an active application for this pet already",
        () => prisma.adoptionApplication.findFirst.mockResolvedValue({ applicationID: 4 }),
        409,
        "You already have an active application for this pet",
      ],
      [
        "no adopter row",
        () => prisma.adopter.findUnique.mockResolvedValue(null),
        404,
        `No adopter exists with ID ${ADOPTER_ID}`,
      ],
    ])("%s → %i", async (_label, arrange, status, message) => {
      eligible();
      arrange();

      const res = await apply();

      expect(res.status).toBe(status);
      expect(res.body.message).toBe(message);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  test("not an Adopter → 403", async () => {
    const res = await request(app)
      .post("/api/v1/adoption-applications")
      .set(auth("Staff", 42))
      .send(VALID_BODY);

    expect(res.status).toBe(403);
  });
});

// ————————————————————— GET ?checkoutSessionId= (confirmation poll) —————————————————————
describe("GET /api/v1/adoption-applications?checkoutSessionId=", () => {
  const poll = (query, role) =>
    request(app).get(`/api/v1/adoption-applications${query}`).set(auth(role));

  test("the adopter's application once the webhook has created it (amountPaid as a number)", async () => {
    prisma.adoptionApplication.findFirst.mockResolvedValue({
      applicationID: 4,
      applicationStatus: "Pending",
      amountPaid: { toString: () => "15", valueOf: () => 15 },
      pet: { petName: "Biscuit" },
    });

    const res = await poll("?checkoutSessionId=cs_test_1");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Adoption application found");
    expect(res.body.data).toMatchObject({ applicationID: 4, amountPaid: 15 });
    expect(prisma.adoptionApplication.findFirst.mock.calls[0][0].where).toEqual({
      adopterID: ADOPTER_ID,
      stripeCheckoutSessionID: "cs_test_1",
    });
  });

  test("not there yet → 200 with null (the poll keeps going)", async () => {
    prisma.adoptionApplication.findFirst.mockResolvedValue(null);

    const res = await poll("?checkoutSessionId=cs_test_1");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toBe("No adoption application found for this checkout session yet");
  });

  test("an empty session id → 400", async () => {
    const res = await poll("?checkoutSessionId=");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("checkoutSessionId is required");
  });

  test("Staff can't use the poll → 403", async () => {
    const res = await poll("?checkoutSessionId=cs_test_1", "Staff");

    expect(res.status).toBe(403);
  });

  test("an Adopter without a session id is asking for the staff queue → 403", async () => {
    const res = await poll("?section=active");

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Only staff or admin can list adoption applications");
  });
});

// ————————————————————— GET /adoption-applications/:id as the adopter —————————————————————
describe("GET /api/v1/adoption-applications/:id (adopter)", () => {
  const detailRow = (overrides = {}) => ({
    applicationID: 4,
    applicationCode: "APP-00004",
    petID: 12,
    adopterID: ADOPTER_ID,
    shelterID: 3,
    staffID: null,
    applicationStatus: "Pending",
    applicationType: "Adopt",
    shelterMessage: null,
    staffRemark: null,
    paymentStatus: "Paid",
    amountPaid: 15,
    createdAt: new Date("2026-10-01"),
    pet: { petName: "Biscuit", petPhoto: "biscuit.jpg", breed: { breedName: "Beagle", species: { speciesName: "Dog" } } },
    shelter: { shelterName: "Downtown", managerStaffID: 60 },
    staff: null,
    adopter: {
      adopterName: "Emelie",
      adopterPhone: null,
      housingType: "House",
      ownsOrRents: "Owns",
      landlordContact: null,
      householdSize: 2,
      numChildren: 0,
      preQualifyFlag: false,
      user: { userEmail: "emelie@example.com" },
    },
    ...overrides,
  });

  test("their own application, without the staff-only extras", async () => {
    prisma.adoptionApplication.findUnique.mockResolvedValue(detailRow());

    const res = await request(app).get("/api/v1/adoption-applications/4").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      applicationID: 4,
      pet: { petName: "Biscuit", breedName: "Beagle", speciesName: "Dog" },
      assignedStaffName: null,
    });
    expect(prisma.governmentID.findFirst).not.toHaveBeenCalled();
    expect(prisma.adoptionApplication.count).not.toHaveBeenCalled();
  });

  test("someone else's application → 403", async () => {
    prisma.adoptionApplication.findUnique.mockResolvedValue(detailRow({ adopterID: 99 }));

    const res = await request(app).get("/api/v1/adoption-applications/4").set(auth());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only view your own adoption applications");
  });

  test("no such application → 404", async () => {
    prisma.adoptionApplication.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/v1/adoption-applications/4").set(auth());

    expect(res.status).toBe(404);
  });

  test("invalid id → 400", async () => {
    const res = await request(app).get("/api/v1/adoption-applications/x").set(auth());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("id is required and must be a positive integer");
  });
});

// ————————————————————— the adopter's lists —————————————————————
describe("GET /api/v1/adopters/me/applications and /adopted-pets", () => {
  test("applications: newest first, filtered, photo as a public URL", async () => {
    prisma.adoptionApplication.findMany.mockResolvedValue([
      { applicationID: 4, pet: { petName: "Biscuit", petPhoto: "biscuit.jpg", breed: { breedName: "Beagle" } } },
    ]);
    prisma.adoptionApplication.count.mockResolvedValue(1);

    const res = await request(app)
      .get("/api/v1/adopters/me/applications?status=Pending&petID=12")
      .set(auth());

    expect(res.status).toBe(200);
    expect(prisma.adoptionApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adopterID: ADOPTER_ID, applicationStatus: "Pending", petID: 12 },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(res.body.data[0].pet.petPhoto).toMatch(/^https?:\/\/.*\/pet-images\/biscuit\.jpg$/);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  test("adopted pets: only Accepted applications whose pet is now adopted, in the PetCard shape", async () => {
    prisma.adoptionApplication.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-05-01"),
        pet: {
          petID: 12,
          petName: "Buddy",
          petDOB: new Date("2022-01-01"),
          petPhoto: "buddy.jpg",
          petSex: "M",
          breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
        },
      },
    ]);

    const res = await request(app).get("/api/v1/adopters/me/adopted-pets").set(auth());

    expect(res.status).toBe(200);
    expect(prisma.adoptionApplication.findMany.mock.calls[0][0].where).toEqual({
      adopterID: ADOPTER_ID,
      applicationStatus: "Accepted",
      pet: { adoptionStatus: "adopted" },
    });
    expect(res.body.data[0]).toMatchObject({ petID: 12, petName: "Buddy", petSex: "Male" });
    expect(res.body.data[0].petPhoto).toMatch(/buddy\.jpg$/);
  });
});
