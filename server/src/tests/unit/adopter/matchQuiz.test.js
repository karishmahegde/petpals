const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database. $transaction resolves
// the array of (already-mocked) operations it's handed, like Prisma's.
jest.mock("../../../config/prisma", () => ({
  adopterQuiz: { findUnique: jest.fn(), upsert: jest.fn() },
  adopterMatch: { deleteMany: jest.fn() },
  $transaction: jest.fn((ops) => Promise.all(ops)),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const { MATCH_QUIZ_QUESTIONS } = require("../../../config/matchQuiz");
const app = require("../../../app");

const signToken = (role, userID = 7) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adopterToken = () => signToken("Adopter", 7);
const staffToken = () => signToken("Staff", 42);

// A valid whole answer set — every question's first option.
const fullAnswers = (overrides = {}) => ({
  ...Object.fromEntries(MATCH_QUIZ_QUESTIONS.map((q) => [q.id, q.options[0].code])),
  ...overrides,
});

const UPDATED_AT = new Date("2026-10-05T10:00:00.000Z");

describe("Match quiz", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/match-quiz/questions", () => {
    test("returns the config's questions and options", async () => {
      const res = await request(app)
        .get("/api/v1/match-quiz/questions")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(MATCH_QUIZ_QUESTIONS);
    });

    test("401 without a token", async () => {
      const res = await request(app).get("/api/v1/match-quiz/questions");
      expect(res.status).toBe(401);
    });

    test("403 for a non-adopter", async () => {
      const res = await request(app)
        .get("/api/v1/match-quiz/questions")
        .set("Authorization", `Bearer ${staffToken()}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/adopters/me/quiz", () => {
    const getQuiz = () =>
      request(app).get("/api/v1/adopters/me/quiz").set("Authorization", `Bearer ${adopterToken()}`);

    test("null when the quiz hasn't been taken", async () => {
      prisma.adopterQuiz.findUnique.mockResolvedValueOnce(null);

      const res = await getQuiz();

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
      expect(prisma.adopterQuiz.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adopterID: 7 } }),
      );
    });

    test("returns the saved answers", async () => {
      prisma.adopterQuiz.findUnique.mockResolvedValueOnce({
        answers: fullAnswers(),
        updatedAt: UPDATED_AT,
      });

      const res = await getQuiz();

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        answers: fullAnswers(),
        updatedAt: UPDATED_AT.toISOString(),
      });
    });

    test("drops answers whose question or option no longer exists", async () => {
      prisma.adopterQuiz.findUnique.mockResolvedValueOnce({
        answers: { ...fullAnswers({ exercise: "retiredCode" }), oldQuestion: "x" },
        updatedAt: UPDATED_AT,
      });

      const res = await getQuiz();

      const { exercise, ...rest } = fullAnswers();
      expect(res.body.data.answers).toEqual(rest);
    });

    test("403 for a non-adopter", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me/quiz")
        .set("Authorization", `Bearer ${staffToken()}`);
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/v1/adopters/me/quiz", () => {
    const saveQuiz = (body) =>
      request(app)
        .put("/api/v1/adopters/me/quiz")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send(body);

    test("saves the whole answer set and clears cached matches in one transaction", async () => {
      const answers = fullAnswers({ exercise: "under30m" });
      prisma.adopterQuiz.upsert.mockResolvedValueOnce({ answers, updatedAt: UPDATED_AT });
      prisma.adopterMatch.deleteMany.mockResolvedValueOnce({ count: 3 });

      const res = await saveQuiz({ answers });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ answers, updatedAt: UPDATED_AT.toISOString() });
      expect(prisma.adopterQuiz.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adopterID: 7 },
          create: { adopterID: 7, answers },
          update: { answers },
        }),
      );
      expect(prisma.adopterMatch.deleteMany).toHaveBeenCalledWith({ where: { adopterID: 7 } });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test("stores answers in config order, whatever order they're sent in", async () => {
      const reversed = Object.fromEntries(Object.entries(fullAnswers()).reverse());
      prisma.adopterQuiz.upsert.mockResolvedValueOnce({ answers: fullAnswers(), updatedAt: UPDATED_AT });
      prisma.adopterMatch.deleteMany.mockResolvedValueOnce({ count: 0 });

      await saveQuiz({ answers: reversed });

      const stored = prisma.adopterQuiz.upsert.mock.calls[0][0].update.answers;
      expect(Object.keys(stored)).toEqual(MATCH_QUIZ_QUESTIONS.map((q) => q.id));
    });

    test.each([
      ["answers missing", {}],
      ["answers not an object", { answers: "rarely" }],
      ["answers an array", { answers: [] }],
      ["unknown question", { answers: fullAnswers({ favouriteColour: "blue" }) }],
      ["unknown option", { answers: fullAnswers({ exercise: "marathon" }) }],
      ["non-string option", { answers: fullAnswers({ exercise: 2 }) }],
      ["option from another question", { answers: fullAnswers({ exercise: "rarely" }) }],
    ])("400 when %s", async (_label, body) => {
      const res = await saveQuiz(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("400 naming the unanswered questions", async () => {
      const { noise, handling, ...partial } = fullAnswers();

      const res = await saveQuiz({ answers: partial });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/noise/);
      expect(res.body.message).toMatch(/handling/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("403 for a non-adopter", async () => {
      const res = await request(app)
        .put("/api/v1/adopters/me/quiz")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ answers: fullAnswers() });
      expect(res.status).toBe(403);
    });
  });
});
