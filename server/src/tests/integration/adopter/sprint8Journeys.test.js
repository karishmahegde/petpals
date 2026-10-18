// Full request-response cycle tests for the Sprint 8 AI journeys, against the
// live test database: an adopter from sign-up through the quiz to their
// matches and a retake that reorders them, and the health passport summary
// shared by staff and vets at a shelter. The unit suites (unit/adopter/
// match*, unit/staff/healthPassportSummary, unit/ai/*) cover each rule in
// isolation; these prove they fit together.
//
// The AI is the one fake: services/ai is mocked (Jest runs under
// NODE_ENV=test) with a stand-in that builds its reply from the prompt it's
// sent, so every other layer — routes, Prisma, the AdopterMatch and
// PetHealthSummary caches — is real. Nothing here can reach the provider
// (tests/setup/noAiProvider.js blanks the AI_* vars as well).
//
// Same conventions as sprint6Journeys: real sign-ups and HTTP calls; the
// supporting cast (shelter managers, vets) force-activated via Prisma since
// their approval is covered elsewhere; everything removed in afterAll —
// users found by the generated emails, so a test that times out after the
// server created an account still gets cleaned up.
jest.mock("../../../services/ai", () => ({
  ...jest.requireActual("../../../services/ai"),
  isAiConfigured: jest.fn(() => true),
  generateStructured: jest.fn(),
}));

const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const ai = require("../../../services/ai");
const { MATCH_QUIZ_QUESTIONS } = require("../../../config/matchQuiz");

const createdEmails = [];
const uniqueEmail = () => {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;
  createdEmails.push(email);
  return email;
};

const PASSWORD = "Secret123!";
const DAY = 24 * 60 * 60 * 1000;
const isoDate = (date) => date.toISOString().slice(0, 10);

// The matcher scores every available pet network-wide on the remote
// database — give the chained journeys room (see sprint6Journeys).
jest.setTimeout(120000);

const register = (name, email, role, shelterID) =>
  request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password: PASSWORD, role, shelterID });

const login = (email) =>
  request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const makeShelter = (label, zip) =>
  prisma.shelter.create({
    data: {
      shelterName: `${label} ${Date.now()}`,
      shelterAddress: "1 Test Way",
      shelterPhone: "555-0100",
      shelterEmail: `${label.replace(/\s+/g, "").toLowerCase()}${Date.now()}@ex.com`,
      shelterZIP: zip,
      shelterSize: 10,
    },
  });

// The first sign-up at a manager-less shelter registers as its (Pending)
// Manager — activate them and link them as the shelter's manager, which a
// vet sign-up there requires.
const makeManager = async (shelter, name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "staff", shelter.shelterID);
  expect(res.status).toBe(201);
  const userID = res.body.data.userID;
  await prisma.staff.update({
    where: { userID },
    data: { accountStatus: "Active", staffDesignation: "Manager", onboardingComplete: true },
  });
  await prisma.shelter.update({
    where: { shelterID: shelter.shelterID },
    data: { managerStaffID: userID },
  });
  const loginRes = await login(email);
  return { userID, token: loginRes.body.data.token };
};

const makeActiveVet = async (shelter, name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "vet", shelter.shelterID);
  expect(res.status).toBe(201);
  const userID = res.body.data.userID;
  await prisma.veterinarian.update({
    where: { userID },
    data: { accountStatus: "Active", onboardingComplete: true, onboardingStep: 5 },
  });
  const loginRes = await login(email);
  return { userID, token: loginRes.body.data.token };
};

const makeAdopter = async (name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "adopter");
  expect(res.status).toBe(201);
  const loginRes = await login(email);
  return { userID: res.body.data.userID, email, name, token: loginRes.body.data.token };
};

// ——————————————— THE FAKE AI ———————————————
// Answers each call from the data it's sent, the way the real model would.
// pet_fit: the journey's own pets get FAKE_FIT_SCORE (so their order is the
// rule score's), anything else 0; each reason names the quiz's exercise
// answer, so a retake shows up in the text. passport_summary: a summary
// counting the notes, and one point citing the newest note.
const FAKE_FIT_SCORE = 80;
const journeyPetIDs = new Set();
const exerciseQuestion = MATCH_QUIZ_QUESTIONS.find((q) => q.id === "exercise");

const fakeAiReply = async ({ schemaName, user }) => {
  const data = JSON.parse(user);
  if (schemaName === "pet_fit") {
    const exercise = data.quiz.find((q) => q.question === exerciseQuestion.prompt)?.answer;
    return {
      matches: data.pets.map(({ petID }) => ({
        petID,
        score: journeyPetIDs.has(petID) ? FAKE_FIT_SCORE : 0,
        reason: `You picked "${exercise}".`,
      })),
    };
  }
  if (schemaName === "passport_summary") {
    const [newest] = data.healthRecords;
    return {
      summary: `Fake summary of ${data.healthRecords.length} health note(s).`,
      pointsToReview: newest
        ? [{ text: "Follow up on the latest note.", sourceType: "healthRecord", sourceID: newest.id }]
        : [],
    };
  }
  throw new Error(`Unexpected AI call: ${schemaName}`);
};

const aiCalls = (schemaName) =>
  ai.generateStructured.mock.calls.filter(([args]) => args.schemaName === schemaName);

describe("Sprint 8 AI journeys", () => {
  let shelterA;
  let shelterB;
  let managerA;
  let managerB;
  let vetA;
  let vetB;
  let speciesID;
  let breedID;
  const petIDs = [];

  beforeAll(async () => {
    ai.generateStructured.mockImplementation(fakeAiReply);

    shelterA = await makeShelter("S8 Journey Shelter A", 10001);
    shelterB = await makeShelter("S8 Journey Shelter B", 10002);
    managerA = await makeManager(shelterA, "S8 Manager A");
    managerB = await makeManager(shelterB, "S8 Manager B");
    vetA = await makeActiveVet(shelterA, "S8 Vet A");
    vetB = await makeActiveVet(shelterB, "S8 Vet B");

    // A species of the journey's own: only its pets can match the adopter's
    // preferred breed, which keeps them clear of every other available pet.
    const species = await prisma.species.create({
      data: { speciesName: `S8JourneySpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;
    const breed = await prisma.breed.create({ data: { speciesID, breedName: "S8JourneyBreed" } });
    breedID = breed.breedID;
  });

  afterAll(async () => {
    const users = await prisma.users.findMany({
      where: { userEmail: { in: createdEmails } },
      select: { userID: true },
    });
    const userIDs = users.map((u) => u.userID);

    // Children before parents. The quiz, match and summary rows cascade
    // from their adopter/pet anyway — deleted explicitly so a failed cascade
    // can't leave them behind.
    await prisma.adopterMatch.deleteMany({
      where: { OR: [{ adopterID: { in: userIDs } }, { petID: { in: petIDs } }] },
    });
    await prisma.adopterQuiz.deleteMany({ where: { adopterID: { in: userIDs } } });
    await prisma.petHealthSummary.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.healthRecord.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.petPhoto.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.pet.deleteMany({ where: { petID: { in: petIDs } } });
    if (breedID) await prisma.breed.deleteMany({ where: { breedID } });
    if (speciesID) await prisma.species.deleteMany({ where: { speciesID } });

    const shelterIDs = [shelterA, shelterB].filter(Boolean).map((s) => s.shelterID);
    // Shelter.managerStaffID → Staff and Staff.shelterID → Shelter point at
    // each other: unlink first, then the role rows and users, then shelters.
    await prisma.shelter.updateMany({
      where: { shelterID: { in: shelterIDs } },
      data: { managerStaffID: null },
    });
    await prisma.adopter.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.veterinarian.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.shelter.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.$disconnect();
  });

  // An available Medium pet of the journey's breed at the manager's
  // shelter, created through the real staff POST /pets.
  const createPet = async (manager, name, petDOB, intakeDate) => {
    const res = await request(app)
      .post("/api/v1/pets")
      .set(bearer(manager.token))
      .send({
        breedID,
        petName: `${name} ${Date.now()}`,
        petDOB,
        petSex: "M",
        petColor: "Brown",
        petSize: "Medium",
        intakeDate,
        petWeight: 12.5,
        petHeight: 40,
        adoptionStatus: "available",
      });
    expect(res.status).toBe(201);
    petIDs.push(res.body.data.petID);
    return res.body.data;
  };

  // ——————————————————————————————————————————————————————————————
  test("adopter: register → quiz → matches → retake → updated matches", async () => {
    // Two pets the adopter fits on everything but energy: a young, lively
    // one and an old, calm one. Activity (the quiz's exercise answer vs the
    // pet's age band) is what separates them, so a retake flips their order.
    const oneYearAgo = new Date(Date.now() - 365 * DAY);
    const monthAgo = new Date(Date.now() - 30 * DAY);
    const young = await createPet(managerA, "S8 Young", isoDate(oneYearAgo), isoDate(monthAgo));
    const old = await createPet(managerA, "S8 Old", "2012-01-01", "2014-01-01");
    journeyPetIDs.add(young.petID);
    journeyPetIDs.add(old.petID);

    // 1. A new adopter has no matches yet — and nothing is computed.
    const adopter = await makeAdopter("S8 Journey Adopter");
    ai.generateStructured.mockClear();
    const noQuiz = await request(app).get("/api/v1/adopters/me/matches").set(bearer(adopter.token));
    expect(noQuiz.status).toBe(200);
    expect(noQuiz.body.data).toEqual({ quizComplete: false, matches: [] });
    expect(ai.generateStructured).not.toHaveBeenCalled();

    // 2. Their profile: the journey's breed, Medium, a house with a yard,
    // very experienced, no children or pets — so both journey pets pass the
    // hard filters and differ only on activity.
    const profileRes = await request(app)
      .put("/api/v1/adopters/me")
      .set(bearer(adopter.token))
      .send({
        preferredBreedID: breedID,
        preferredSize: "Medium",
        housingType: "House",
        yardAvailable: true,
        petExperience: "Very",
        numChildren: 0,
        currentPets: 0,
      });
    expect(profileRes.status).toBe(200);

    // 3. The quiz: the questions come from the API; the answers lean active.
    const questionsRes = await request(app)
      .get("/api/v1/match-quiz/questions")
      .set(bearer(adopter.token));
    expect(questionsRes.status).toBe(200);
    const questions = questionsRes.body.data;
    expect(questions.map((q) => q.id)).toEqual(MATCH_QUIZ_QUESTIONS.map((q) => q.id));

    const answersWith = (exercise) => ({
      ...Object.fromEntries(questions.map((q) => [q.id, q.options[0].code])),
      exercise,
    });
    const optionLabel = (code) => exerciseQuestion.options.find((o) => o.code === code).label;
    // Second and third of the four options (not the extremes), so each pet's
    // rule score stays above anything another species' pet can reach.
    const ACTIVE = exerciseQuestion.options[1].code;
    const CALM = exerciseQuestion.options[2].code;

    const quizRes = await request(app)
      .put("/api/v1/adopters/me/quiz")
      .set(bearer(adopter.token))
      .send({ answers: answersWith(ACTIVE) });
    expect(quizRes.status).toBe(200);
    expect(quizRes.body.data.answers.exercise).toBe(ACTIVE);

    // 4. Matches: computed once — rule shortlist, one AI call, cached.
    const getMatches = () =>
      request(app).get("/api/v1/adopters/me/matches").set(bearer(adopter.token));

    const first = await getMatches();
    expect(first.status).toBe(200);
    expect(first.body.data.quizComplete).toBe(true);
    const [top, second] = first.body.data.matches;
    expect(top).toMatchObject({
      petID: young.petID,
      aiExplained: true,
      reason: `You picked "${optionLabel(ACTIVE)}".`,
      breed: { breedName: "S8JourneyBreed" },
    });
    expect(second.petID).toBe(old.petID);
    expect(top.score).toBeGreaterThan(second.score);

    expect(aiCalls("pet_fit")).toHaveLength(1);
    // The prompt carries the quiz and the pets — never who the adopter is.
    const [{ user: prompt }] = aiCalls("pet_fit")[0];
    expect(prompt).not.toContain(adopter.email);
    expect(prompt).not.toContain(adopter.name);
    const sentIDs = JSON.parse(prompt).pets.map((p) => p.petID);
    expect(sentIDs).toEqual(expect.arrayContaining([young.petID, old.petID]));

    const cached = await prisma.adopterMatch.findMany({
      where: { adopterID: adopter.userID, petID: { in: [young.petID, old.petID] } },
    });
    expect(cached).toHaveLength(2);
    expect(cached.every((row) => row.aiScore === FAKE_FIT_SCORE)).toBe(true);

    // 5. A second visit is served from the cache — no AI call.
    const again = await getMatches();
    expect(again.body.data.matches.map((m) => m.petID)).toEqual(
      first.body.data.matches.map((m) => m.petID),
    );
    expect(aiCalls("pet_fit")).toHaveLength(1);

    // 6. Retake, leaning calm: saving clears the cached matches.
    const retakeRes = await request(app)
      .put("/api/v1/adopters/me/quiz")
      .set(bearer(adopter.token))
      .send({ answers: answersWith(CALM) });
    expect(retakeRes.status).toBe(200);
    expect(await prisma.adopterMatch.count({ where: { adopterID: adopter.userID } })).toBe(0);

    // 7. Updated matches: recomputed with the new answers — the calm, old
    // pet now leads, and the reasons follow the new answer.
    const updated = await getMatches();
    expect(updated.status).toBe(200);
    const [newTop, newSecond] = updated.body.data.matches;
    expect(newTop).toMatchObject({
      petID: old.petID,
      aiExplained: true,
      reason: `You picked "${optionLabel(CALM)}".`,
    });
    expect(newSecond.petID).toBe(young.petID);
    expect(aiCalls("pet_fit")).toHaveLength(2);

    // Only adopters get matches.
    const staffRes = await request(app).get("/api/v1/adopters/me/matches").set(bearer(managerA.token));
    expect(staffRes.status).toBe(403);
  });

  // ——————————————————————————————————————————————————————————————
  test("passport summary: staff and vet at the shelter share one cached summary; a new note regenerates it; others are denied", async () => {
    const pet = await createPet(managerA, "S8 Passport", "2020-05-01", "2023-01-01");
    const summaryPath = `/api/v1/pets/${pet.petID}/health-passport/summary`;
    const getSummary = (token) => request(app).get(summaryPath).set(bearer(token));
    const addNote = (recordDesc) =>
      request(app)
        .post(`/api/v1/pets/${pet.petID}/health-records`)
        .set(bearer(vetA.token))
        .send({ recordDesc });
    ai.generateStructured.mockClear();

    // 1. The passport tells the client the button can be enabled.
    const passportRes = await request(app)
      .get(`/api/v1/staff/me/pets/${pet.petID}/health-passport`)
      .set(bearer(managerA.token));
    expect(passportRes.status).toBe(200);
    expect(passportRes.body.data.aiSummaryAvailable).toBe(true);

    // 2. Nothing on file yet → the fixed summary, no AI call, nothing cached.
    const empty = await getSummary(managerA.token);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toMatchObject({ aiAvailable: true, pointsToReview: [], generatedAt: null });
    expect(empty.body.data.summary).toMatch(/No health records/);
    expect(aiCalls("passport_summary")).toHaveLength(0);

    // 3. The vet writes a note; staff summarise — one AI call, cached.
    const noteRes = await addNote("Mild limp on the left foreleg, recheck in two weeks.");
    expect(noteRes.status).toBe(201);
    const firstNoteID = noteRes.body.data.recordID;

    const staffSummary = await getSummary(managerA.token);
    expect(staffSummary.status).toBe(200);
    expect(staffSummary.body.data).toMatchObject({
      aiAvailable: true,
      summary: "Fake summary of 1 health note(s).",
      pointsToReview: [
        {
          text: "Follow up on the latest note.",
          source: { type: "healthRecord", recordID: firstNoteID },
          origin: "ai",
        },
      ],
    });
    expect(aiCalls("passport_summary")).toHaveLength(1);
    // No vet's or staff member's name travels to the model.
    const [{ user: prompt }] = aiCalls("passport_summary")[0];
    expect(prompt).not.toContain("S8 Vet A");
    expect(prompt).not.toContain("S8 Manager A");
    const stored = await prisma.petHealthSummary.findUnique({ where: { petID: pet.petID } });
    expect(stored.summary).toBe("Fake summary of 1 health note(s).");

    // 4. The vet at the shelter gets the same cached summary — no new call.
    const vetSummary = await getSummary(vetA.token);
    expect(vetSummary.status).toBe(200);
    expect(vetSummary.body.data.summary).toBe(staffSummary.body.data.summary);
    expect(aiCalls("passport_summary")).toHaveLength(1);

    // 5. A second note changes the passport → regenerated, and it cites the
    // newest note.
    const secondNoteRes = await addNote("Limp resolved at recheck.");
    expect(secondNoteRes.status).toBe(201);
    const regenerated = await getSummary(vetA.token);
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.summary).toBe("Fake summary of 2 health note(s).");
    expect(regenerated.body.data.pointsToReview[0].source.recordID).toBe(
      secondNoteRes.body.data.recordID,
    );
    expect(aiCalls("passport_summary")).toHaveLength(2);

    // 6. Denials — none of them reach the AI.
    const adopter = await makeAdopter("S8 Passport Adopter");
    expect((await getSummary(managerB.token)).status).toBe(403); // staff elsewhere
    expect((await getSummary(vetB.token)).status).toBe(404); // vet elsewhere, like the passport
    expect((await getSummary(adopter.token)).status).toBe(403); // wrong role
    expect((await request(app).get(summaryPath)).status).toBe(401); // no token
    expect(aiCalls("passport_summary")).toHaveLength(2);
  });
});
