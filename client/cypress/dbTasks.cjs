// Database tasks for the Cypress specs (registered in cypress.config.ts). The
// specs still create accounts the real way — through the API — and use these
// only for what the API can't do for a test, the same shortcuts the
// integration suites take: an available pet to apply for (creating one
// through the API needs a fully approved staff member), marking an email
// verified (the real link only exists in an email), finishing an adopter's
// onboarding (applying is closed until the wizard is done), signing the
// Stripe webhook that records a paid application, and removing everything
// afterwards with the integration suites' own tracker
// (server/src/tests/integration/helpers/testData.js), even if a spec failed.
//
// Runs in Cypress's Node process against the database in server/.env — the
// same one the dev servers use.
const path = require("path");

const serverDir = path.resolve(__dirname, "../../server");
require(path.join(serverDir, "node_modules/dotenv")).config({ path: path.join(serverDir, ".env") });
const prisma = require(path.join(serverDir, "src/config/prisma"));
const stripe = require(path.join(serverDir, "src/config/stripe"));
const { trackTestData } = require(path.join(serverDir, "src/tests/integration/helpers/testData"));

// One tracker for the whole run; cleanUp empties it.
let data = trackTestData();

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

const tasks = {
  // A login created by a spec (cy.registerTestAdopter records it).
  "db:trackUser"(userID) {
    data.user(userID);
    return null;
  },

  // An Open shelter with one available pet of its own species; returns
  // { petID, petName, shelterID, speciesID }.
  async "db:availablePet"() {
    const id = stamp();
    const shelter = await prisma.shelter.create({
      data: {
        shelterName: `Cypress Shelter ${id}`,
        shelterAddress: "1 Test Way",
        shelterPhone: "555-0100",
        shelterEmail: `cyshelter${id}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 10,
      },
    });
    data.shelter(shelter.shelterID);
    const species = await prisma.species.create({ data: { speciesName: `CypressSpecies-${id}` } });
    data.species(species.speciesID);
    const breed = await prisma.breed.create({ data: { speciesID: species.speciesID, breedName: "CypressBreed" } });
    const pet = await prisma.pet.create({
      data: {
        breedID: breed.breedID,
        shelterID: shelter.shelterID,
        petName: "Cypress Biscuit",
        petDOB: new Date("2022-01-01"),
        petSex: "F",
        petColor: "Tan",
        petSize: "Medium",
        petBGroup: "N/A",
        petWeight: 10,
        petHeight: 30,
        intakeDate: new Date(),
        petPhoto: "placeholder.jpg",
        adoptionStatus: "available",
      },
    });
    data.pet(pet.petID);
    return { petID: pet.petID, petName: pet.petName, shelterID: shelter.shelterID, speciesID: species.speciesID };
  },

  // A checkout.session.completed event for a paid application fee, signed
  // with the server's webhook secret — what Stripe sends once an adopter
  // pays. Returns { payload, signature } for the spec to POST to
  // /webhooks/stripe, which creates the Pending application. Same approach
  // as the Sprint 3 integration journey; nothing is sent to Stripe.
  "stripe:paidApplicationEvent"({ adopterID, petID, shelterID }) {
    const id = stamp();
    const payload = JSON.stringify({
      id: `evt_test_cypress_${id}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_cypress_${id}`,
          object: "checkout.session",
          payment_status: "paid",
          payment_intent: `pi_test_cypress_${id}`,
          metadata: {
            petID: String(petID),
            adopterID: String(adopterID),
            shelterID: String(shelterID),
            applicationType: "Adopt",
            shelterMessage: "",
          },
        },
      },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    return { payload, signature };
  },

  // Marks a login's email verified — what opening the emailed link does.
  async "db:verifyEmail"(email) {
    await prisma.users.update({ where: { userEmail: email }, data: { emailVerified: true } });
    return null;
  },

  // Finishes an adopter's onboarding wizard — applying to adopt stays closed
  // until it's done (OnboardingGate), and clicking through all seven steps
  // isn't what these specs test.
  async "db:completeOnboarding"(email) {
    const user = await prisma.users.findUnique({ where: { userEmail: email }, select: { userID: true } });
    await prisma.adopter.update({
      where: { userID: user.userID },
      data: { onboardingComplete: true, onboardingStep: 7 },
    });
    return null;
  },

  // Removes everything the run created, children first.
  async "db:cleanUp"() {
    await data.cleanUp();
    data = trackTestData();
    return null;
  },
};

module.exports = { tasks };
