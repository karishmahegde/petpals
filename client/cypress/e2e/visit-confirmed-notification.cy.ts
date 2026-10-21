// Visits and the Sprint 10 notification path, end to end: an adopter books a
// visit from the Visits tab, a staff member at that shelter confirms it
// through the API, and — with no reload — the adopter's bell lights up with
// "Visit confirmed" over the live notification stream. Clicking it opens that
// visit's details.
// The staff member signs up through the API and is approved with a database
// task (approval itself is covered by the integration journeys), and only
// their access token is kept: cy.request shares the browser's cookies, and
// the app restores a session from the refresh cookie on every page load, so
// the staff member's cookie is cleared before the adopter's first visit.
interface TestPet {
  petID: number;
  petName: string;
  shelterID: number;
  shelterName: string;
}

// A week from now at 10:30 local time, as <input type="datetime-local"> takes it.
const nextWeekAtHalfTen = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:30`;
};

describe("Visit booked, confirmed by staff, adopter notified", () => {
  let pet: TestPet;
  let staffToken: string;

  before(() => {
    cy.task<TestPet>("db:availablePet").then((created) => {
      pet = created;

      const staff = {
        name: "Cypress Staff",
        email: `cystaff${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`,
        password: "Secret123!",
      };
      cy.request("POST", "/api/v1/auth/register", {
        ...staff,
        role: "staff",
        shelterID: pet.shelterID,
      }).then((res) => {
        const userID: number = res.body.data.userID;
        cy.task("db:trackUser", userID);
        cy.task("db:activateStaff", userID);
      });
      cy.request("POST", "/api/v1/auth/login", {
        email: staff.email,
        password: staff.password,
      }).then((res) => {
        staffToken = res.body.data.token;
      });
      cy.clearAllCookies();
    });
  });

  it("shows the confirmation in the bell without a reload and opens the visit from it", () => {
    cy.registerTestAdopter("Cypress Visiting Adopter").then((adopter) => {
      cy.task("db:completeOnboarding", adopter.email);

      cy.visit("/adopter/visits");
      cy.loginThroughForm(adopter.email, adopter.password);
      cy.location("pathname").should("eq", "/adopter/visits");
      cy.get('button[aria-label="Notifications"]').should("be.visible");

      // Book the visit.
      cy.intercept("POST", "/api/v1/visits").as("bookVisit");
      cy.contains("button", "Schedule Visit").click();
      cy.contains('[role="dialog"]', "Schedule a Visit").within(() => {
        cy.get("#visit-shelter").select(pet.shelterName);
        cy.get("#visit-pet").find("option").should("contain", pet.petName);
        cy.get("#visit-pet").select(`${pet.petName} — CypressBreed`);
        cy.get("#visit-time").type(nextWeekAtHalfTen());
        cy.get("#visit-remarks").type("Looking forward to meeting her.");
        cy.contains("button", "Schedule Visit").click();
      });
      cy.contains("Visit scheduled!").should("be.visible");
      cy.contains("li", pet.petName).should("be.visible");

      // Staff confirm it, outside this browser tab.
      cy.wait("@bookVisit").then(({ response }) => {
        expect(response?.statusCode).to.eq(201);
        const visitID: number = response?.body.data.visitID;

        cy.request({
          method: "PATCH",
          url: `/api/v1/visits/${visitID}`,
          headers: { Authorization: `Bearer ${staffToken}` },
          body: { visitStatus: "Confirmed" },
        })
          .its("status")
          .should("eq", 200);

        // The stream delivers it — no cy.reload() anywhere in this test.
        cy.get('button[aria-label="Notifications, 1 unread"]', { timeout: 15000 }).click();
        cy.get('[role="region"][aria-label="Notifications"]').within(() => {
          cy.contains("Visit confirmed").should("be.visible");
          cy.contains(`${pet.shelterName} confirmed your visit to meet ${pet.petName}.`).click();
        });

        // The notification links to /adopter/visits?visitID=… — the page
        // opens that visit's details.
        cy.contains('[role="dialog"]', "Visit Details").within(() => {
          cy.contains(pet.petName).should("be.visible");
          cy.contains("Confirmed").should("be.visible");
        });
        cy.location("search").should("not.contain", "visitID");
        cy.get('button[aria-label="Notifications"]').should("exist");
      });
    });
  });
});
